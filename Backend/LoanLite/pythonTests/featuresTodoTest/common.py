"""
Shared test harness for todo/featuresTodo.csv regression tests.

Each task in todo/featuresTodo.csv gets its own file in this folder
(pythonTests/featuresTodoTest/taskNN_description.py), written against the
design already agreed in that task's CSV row - BEFORE the task is
implemented, unlike TempTest.py which only added a section once a task's
Status flipped to Done. That means a task's file is expected to FAIL (or
hit 404s for endpoints that don't exist yet) until that task actually
lands; from then on it's that task's regression test. Re-run a task's file
after implementing it, fix any assumption this harness got wrong about the
exact design (endpoint path, status string, action name, ...), and keep it
green from then on.

This module never registers users or writes to the database directly -
it only logs in the fixed-email accounts that pythonTests/TempTest.py
creates and role-assigns (applicant/processor/underwriter/admin.temptest@
loanlite.test, plus the *2 variants for ownership-boundary checks). Run
TempTest.py first on a fresh database so these exist before running any
file in this folder.

Usage inside a task file:

    from common import *

    users = setup_users()
    app = create_application(users.applicant)
    call("PATCH", f"/applications/submit/{app['id']}", token=users.applicant.token, expect=200,
         label="applicant submits the application")
    ...
    print_summary()
"""

import io
import sys
from types import SimpleNamespace

import requests

# Windows' console defaults to a cp1252-family codec that can't encode characters like the
# rupee sign (backendTodo follow-up, 2026-08-24, ProcessorController.formatInr()) - reconfigure
# stdout to UTF-8 so a response body containing non-ASCII text doesn't crash print() mid-run.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE = "http://localhost:8080/api"
TIMEOUT = 15
PASSWORD = "TestPass123!"

RESULTS = []  # list of (passed: bool, label: str)
SKIPPED = []  # list of label strings


def section(title):
    print(f"\n=== {title} ===")


def record(passed, label):
    RESULTS.append((passed, label))
    tag = "PASS" if passed else "FAIL"
    print(f"  [{tag}] {label}")
    return passed


def skip(label):
    SKIPPED.append(label)
    print(f"  [SKIP] {label}")


def auth(token):
    return {"Authorization": f"Bearer {token}"} if token else {}


def call(method, path, token=None, expect=None, label=None, **kwargs):
    url = f"{BASE}{path}"
    headers = kwargs.pop("headers", {})
    headers.update(auth(token))
    try:
        resp = requests.request(method, url, headers=headers, timeout=TIMEOUT, **kwargs)
    except requests.exceptions.ConnectionError:
        print(f"\n[ABORT] Could not reach {url}.")
        print("Is the Spring Boot app running on http://localhost:8080 ?")
        sys.exit(1)

    lbl = label or f"{method} {path}"
    if expect is not None:
        ok = resp.status_code == expect
        record(ok, f"{lbl} -> expected {expect}, got {resp.status_code}")
        if not ok:
            print(f"         body: {response_snippet(resp)}")
    return resp


def response_snippet(resp, limit=300):
    try:
        body = resp.json()
        text = body.get("message", body) if isinstance(body, dict) else body
    except ValueError:
        text = resp.text
    text = str(text)
    return text[:limit] + ("..." if len(text) > limit else "")


def page_content(resp):
    """The 6 list endpoints paginated under featuresTodo.csv task 11 now return
    Spring Data's Page<T> JSON shape ({content: [...], totalElements, ...})
    instead of a bare array - unwrap it here so call sites can keep treating
    the result as a plain list."""
    body = resp.json()
    return body.get("content", []) if isinstance(body, dict) else body


def exists(path, token):
    r = requests.get(f"{BASE}{path}", headers=auth(token), timeout=TIMEOUT)
    return r.status_code == 200


def guarded(path, token, action, label):
    """Runs `action()` only if a GET to `path` with `token` returns 200 -
    used to skip a mutation cleanly when an earlier step in the same test
    (itself already recorded as a FAIL) means the target no longer exists
    or isn't reachable, instead of cascading into a wall of misleading
    follow-on failures."""
    if exists(path, token):
        action()
    else:
        skip(f"{label}: {path} not found before mutating, skipping")


def login_silent(email):
    """Doesn't record a PASS/FAIL - a failed login just means this fixed
    account doesn't exist yet (run TempTest.py first)."""
    try:
        r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": PASSWORD}, timeout=TIMEOUT)
    except requests.exceptions.ConnectionError:
        print(f"\n[ABORT] Could not reach {BASE}/auth/login.")
        print("Is the Spring Boot app running on http://localhost:8080 ?")
        sys.exit(1)
    return r.json().get("token") if r.status_code == 200 else None


def whoami(token, label):
    r = call("GET", "/auth/me", token=token, expect=200, label=label)
    return r.json() if r.ok else None


# Fixed accounts created/role-assigned by pythonTests/TempTest.py.
ACCOUNTS = {
    "applicant": "applicant.temptest@loanlite.test",
    "processor": "processor.temptest@loanlite.test",
    "underwriter": "underwriter.temptest@loanlite.test",
    "admin": "admin.temptest@loanlite.test",
    "applicant2": "applicant2.temptest@loanlite.test",
    "processor2": "processor2.temptest@loanlite.test",
    "underwriter2": "underwriter2.temptest@loanlite.test",
}


def setup_users():
    """Logs in all 7 fixed TempTest.py accounts and returns a namespace:
    users.applicant.token / .id / .email / .role, users.processor2, etc.
    Aborts with a clear message if any of them don't exist yet - this
    function never registers or role-assigns anyone, that's TempTest.py's
    job, run once (or after a fresh database)."""
    section("Setup: log in fixed TempTest.py accounts")
    users = SimpleNamespace()
    missing = []
    for key, email in ACCOUNTS.items():
        token = login_silent(email)
        if not token:
            missing.append(email)
            continue
        me = whoami(token, f"fetch {key} via /auth/me")
        if not me:
            missing.append(email)
            continue
        setattr(users, key, SimpleNamespace(token=token, id=me["id"], email=email, role=me.get("role")))

    if missing:
        print("\n[ABORT] These accounts don't exist yet (or couldn't log in):")
        for email in missing:
            print(f"  - {email}")
        print("\nRun pythonTests/TempTest.py first - it creates and role-assigns all 7 accounts.")
        sys.exit(1)

    return users


def create_application(applicant_user, expect=201, label=None, **overrides):
    """Applicant creates a base Draft application. Pass field overrides as
    kwargs (loanAmount, tenureMonths, declaredIncome, ...)."""
    body = {"applicant": {"id": applicant_user.id}, "loanAmount": 200000,
            "tenureMonths": 24, "declaredIncome": 45000}
    body.update(overrides)
    r = call("POST", "/applications", token=applicant_user.token, json=body, expect=expect,
             label=label or "create application for test setup")
    return r.json() if r.ok else None


def upload_document(app_id, token, doc_type, expect=201, label=None):
    # application/pdf, not text/plain - featuresTodo.csv task 10's content-type allow-list
    # rejects text/plain now.
    files = {"file": (f"{doc_type.lower()}.pdf", io.BytesIO(b"%PDF-1.4 dummy file contents"), "application/pdf")}
    data = {"documentType": doc_type}
    return call("POST", f"/applications/{app_id}/documents", token=token,
                files=files, data=data, expect=expect,
                label=label or f"upload {doc_type}")


def upload_all_required_documents(app_id, token):
    """Uploads PAN_CARD/SALARY_SLIP/ADDRESS_PROOF and returns the list of
    created document ids (skips any that fail, they'll show as a FAIL)."""
    doc_ids = []
    for doc_type in ("PAN_CARD", "SALARY_SLIP", "ADDRESS_PROOF"):
        r = upload_document(app_id, token, doc_type, label=f"upload {doc_type} for application {app_id}")
        if r.ok:
            doc_ids.append(r.json()["id"])
    return doc_ids


def history_for_application(app_id, token):
    """GET /api/application-history has no query params (no per-application
    filter exists in the controller), so this fetches everything the caller
    can see and filters client-side - same pattern TempTest.py uses for
    DocumentController.list()."""
    # Paginated since featuresTodo.csv task 11 - a large enough size to comfortably cover a
    # single test run's entries without needing real pagination here.
    r = call("GET", "/application-history", token=token, params={"size": 200}, expect=200,
             label=f"list application-history to find entries for application {app_id}")
    if not r.ok:
        return []
    # ApplicationHistory.application is @JsonBackReference'd out of the response
    # (needed to avoid infinite recursion with LoanApplication.applicationHistory) - the
    # flat "applicationId" field is what's actually usable here.
    return [h for h in page_content(r) if h.get("applicationId") == app_id]


def cleanup_application(app_id, admin_user, doc_ids=None):
    """Best-effort teardown, mirrors TempTest.py's guarded()-wrapped cleanup
    pattern - documents first (FK), then the application, using the admin
    token so cleanup doesn't depend on ownership/status rules under test."""
    for doc_id in (doc_ids or []):
        guarded(
            f"/documents/{doc_id}", admin_user.token,
            lambda doc_id=doc_id: call("DELETE", f"/documents/{doc_id}", token=admin_user.token, expect=204,
                                        label=f"cleanup: delete document {doc_id}"),
            f"cleanup: delete document {doc_id}",
        )
    guarded(
        f"/applications/{app_id}", admin_user.token,
        lambda: call("DELETE", f"/applications/{app_id}", token=admin_user.token, expect=204,
                     label=f"cleanup: delete application {app_id}"),
        f"cleanup: delete application {app_id}",
    )


def print_summary():
    section("SUMMARY")
    passed = sum(1 for ok, _ in RESULTS if ok)
    failed = sum(1 for ok, _ in RESULTS if not ok)
    print(f"{passed} passed, {failed} failed, {len(SKIPPED)} skipped (out of {len(RESULTS)} checks)")

    if failed:
        print("\nFailures:")
        for ok, label in RESULTS:
            if not ok:
                print(f"  - {label}")

    if SKIPPED:
        print("\nSkipped:")
        for label in SKIPPED:
            print(f"  - {label}")

    sys.exit(1 if failed else 0)
