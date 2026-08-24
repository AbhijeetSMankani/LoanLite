"""
Authorization regression test for the preAuthorize lockdown effort.

Companion to EndpointTest.py (which is a general happy-path smoke test).
This file is specifically for todo/preAuthorizeTodo.csv: every task in that
list gets one section here, and the section is filled in with real checks
as soon as that task's Status flips to "Done". Re-run this file after every
task lands, adding the new task's section instead of writing a one-off
throwaway script each time - the point is a growing regression suite that
proves earlier lockdowns don't regress while later ones are added.

Each task's section must check REJECTION as thoroughly as the happy path,
not just that the allowed caller succeeds. At minimum: no token -> 401,
every role that should NOT have access -> 403 (one call per wrong role,
including admin where the endpoint has no admin override), and any
state/ownership/not-found guard the endpoint enforces (wrong status,
nonexistent id, wrong owner) -> its actual status code. A task section
that only proves the happy path is incomplete.

Usage:
    pip install requests
    python TempTest.py

The Spring Boot app must already be running on http://localhost:8080.

Unlike EndpointTest.py, this script uses fixed-email accounts
(applicant/processor/underwriter/admin.temptest@loanlite.test, plus a
second applicant/processor/underwriter - *2.temptest@loanlite.test - for
proving ownership boundaries between two people with the same role) and
reuses them across runs instead of registering new random ones every
time. On the very first run - or on a fresh database - it registers
whichever of them don't exist yet and pauses once so you can set their
roles directly in the database; every run after that just logs in with
the roles already in place, no manual step needed. Applications/documents
created during a run are still cleaned up at the end.
"""

import io
import sys

import requests

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
    if exists(path, token):
        action()
    else:
        skip(f"{label}: {path} not found before mutating, skipping")


def register(email, first, last):
    r = call(
        "POST", "/auth/register",
        json={"email": email, "password": PASSWORD, "firstName": first, "lastName": last},
        expect=201, label=f"register {email}",
    )
    return r.json() if r.ok else None


def login(email):
    r = call(
        "POST", "/auth/login",
        json={"email": email, "password": PASSWORD},
        expect=200, label=f"login {email}",
    )
    return r.json().get("token") if r.ok else None


def login_silent(email):
    """Like login(), but doesn't record a PASS/FAIL - a failed login here just
    means this fixed-email account doesn't exist yet on a fresh database."""
    try:
        r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": PASSWORD}, timeout=TIMEOUT)
    except requests.exceptions.ConnectionError:
        print(f"\n[ABORT] Could not reach {BASE}/auth/login.")
        print("Is the Spring Boot app running on http://localhost:8080 ?")
        sys.exit(1)
    return r.json().get("token") if r.status_code == 200 else None


def get_or_create_user(email, first, last):
    """Reuses the account if it already exists (from a previous run of this
    script) instead of registering a fresh random one every time - that's
    what let us stop asking for a manual DB role UPDATE on every run."""
    token = login_silent(email)
    if token:
        return token, False
    user = register(email, first, last)
    if not user:
        print(f"\n[ABORT] Could not register {email}, cannot continue.")
        sys.exit(1)
    token = login_silent(email)
    if not token:
        print(f"\n[ABORT] Registered {email} but could not log in immediately after.")
        sys.exit(1)
    return token, True


def whoami(token, label):
    r = call("GET", "/auth/me", token=token, expect=200, label=label)
    return r.json() if r.ok else None


# ---------------------------------------------------------------------------
# Setup: reuse or create the four role accounts
# ---------------------------------------------------------------------------
section("Setup: reuse or create test users (one per role)")

applicant_email = "applicant.temptest@loanlite.test"
processor_email = "processor.temptest@loanlite.test"
underwriter_email = "underwriter.temptest@loanlite.test"
admin_email = "admin.temptest@loanlite.test"

applicant_token, applicant_is_new = get_or_create_user(applicant_email, "Alice", "Applicant")
processor_token, processor_is_new = get_or_create_user(processor_email, "Pat", "Processor")
underwriter_token, underwriter_is_new = get_or_create_user(underwriter_email, "Uma", "Underwriter")
admin_token, admin_is_new = get_or_create_user(admin_email, "Adam", "Admin")

# A second account per staff-ish role, used purely to prove ownership boundaries
# BETWEEN two people with the same role (e.g. processor A can't see an application
# assigned to processor B) - role checks alone can't demonstrate that, only the
# per-application ownership guard can.
applicant2_email = "applicant2.temptest@loanlite.test"
processor2_email = "processor2.temptest@loanlite.test"
underwriter2_email = "underwriter2.temptest@loanlite.test"

applicant2_token, applicant2_is_new = get_or_create_user(applicant2_email, "Amy", "Applicant")
processor2_token, processor2_is_new = get_or_create_user(processor2_email, "Priya", "Processor")
underwriter2_token, underwriter2_is_new = get_or_create_user(underwriter2_email, "Uday", "Underwriter")

# ---------------------------------------------------------------------------
# Setup: manual role assignment, only for accounts just now created
# ---------------------------------------------------------------------------
staff_needing_roles = [
    (admin_email, "ROLE_ADMIN") if admin_is_new else None,
    (processor_email, "ROLE_PROCESSOR") if processor_is_new else None,
    (underwriter_email, "ROLE_UNDERWRITER") if underwriter_is_new else None,
    (processor2_email, "ROLE_PROCESSOR") if processor2_is_new else None,
    (underwriter2_email, "ROLE_UNDERWRITER") if underwriter2_is_new else None,
]
staff_needing_roles = [row for row in staff_needing_roles if row]

if staff_needing_roles:
    section("Setup: manual role assignment required (new accounts only)")
    print("""
Role assignment isn't exposed through the API yet. Run these against the
database directly (roles must keep the ROLE_ prefix - that's what
CustomUserDetailsService hands to Spring Security):
""")
    for email, role in staff_needing_roles:
        print(f"  UPDATE users SET role = '{role}' WHERE email = '{email}';")
    print()
    input("Press Enter once the roles above are set in the database...")

    # tokens issued above were minted before the role update, so refresh them
    if admin_is_new:
        admin_token = login(admin_email)
    if processor_is_new:
        processor_token = login(processor_email)
    if underwriter_is_new:
        underwriter_token = login(underwriter_email)
    if processor2_is_new:
        processor2_token = login(processor2_email)
    if underwriter2_is_new:
        underwriter2_token = login(underwriter2_email)
else:
    print("\n  All accounts already existed with roles already set - skipping DB setup.")

applicant_me = whoami(applicant_token, "fetch applicant via /auth/me")
processor_me = whoami(processor_token, "fetch processor via /auth/me")
underwriter_me = whoami(underwriter_token, "fetch underwriter via /auth/me")
admin_me = whoami(admin_token, "fetch admin via /auth/me")
applicant2_me = whoami(applicant2_token, "fetch applicant2 via /auth/me")
processor2_me = whoami(processor2_token, "fetch processor2 via /auth/me")
underwriter2_me = whoami(underwriter2_token, "fetch underwriter2 via /auth/me")

if not all([applicant_me, processor_me, underwriter_me, admin_me, applicant2_me, processor2_me, underwriter2_me]):
    print("\n[ABORT] Could not resolve one or more user records via /auth/me.")
    sys.exit(1)

applicant_id = applicant_me["id"]
processor_id = processor_me["id"]
underwriter_id = underwriter_me["id"]
admin_id = admin_me["id"]
applicant2_id = applicant2_me["id"]
processor2_id = processor2_me["id"]
underwriter2_id = underwriter2_me["id"]

print(f"\n  applicant_id={applicant_id}  processor_id={processor_id}  "
      f"underwriter_id={underwriter_id}  admin_id={admin_id}")
print(f"  applicant2_id={applicant2_id}  processor2_id={processor2_id}  "
      f"underwriter2_id={underwriter2_id}")

record("USER" in (applicant_me.get("role") or ""), f"applicant role is '{applicant_me.get('role')}'")
record("PROCESSOR" in (processor_me.get("role") or ""), f"processor role is '{processor_me.get('role')}'")
record("UNDERWRITER" in (underwriter_me.get("role") or ""), f"underwriter role is '{underwriter_me.get('role')}'")
record("ADMIN" in (admin_me.get("role") or ""), f"admin role is '{admin_me.get('role')}'")
record("USER" in (applicant2_me.get("role") or ""), f"applicant2 role is '{applicant2_me.get('role')}'")
record("PROCESSOR" in (processor2_me.get("role") or ""), f"processor2 role is '{processor2_me.get('role')}'")
record("UNDERWRITER" in (underwriter2_me.get("role") or ""), f"underwriter2 role is '{underwriter2_me.get('role')}'")

# ---------------------------------------------------------------------------
# Setup: one application to hang document checks off of
# ---------------------------------------------------------------------------
section("Setup: create a base application for the checks below")

r = call("POST", "/applications", token=applicant_token,
          json={"applicant": {"id": applicant_id}, "loanAmount": 200000,
                "tenureMonths": 24, "declaredIncome": 45000},
          expect=201, label="applicant creates base application")
base_app = r.json() if r.ok else None
if not base_app:
    print("\n[ABORT] Could not create the base application, cannot continue.")
    sys.exit(1)
base_app_id = base_app["id"]

# ---------------------------------------------------------------------------
# Task 1: LoanApplication ownership/access-check helper - Done
# ---------------------------------------------------------------------------
section("Task 1: ownership/access-check helper")

skip("Task 1 is an internal helper (LoanApplicationAccessGuard), not directly "
     "reachable over HTTP - covered indirectly by the tasks that call it.")

# ---------------------------------------------------------------------------
# Task 2: UnderwriterController claim endpoint - Done
# ---------------------------------------------------------------------------
section("Task 2: UnderwriterController claim endpoint")

r = call("POST", "/applications", token=applicant_token,
          json={"applicant": {"id": applicant_id}, "loanAmount": 300000,
                "tenureMonths": 24, "declaredIncome": 50000},
          expect=201, label="applicant creates task-2 application")
task2_app = r.json() if r.ok else None

if not task2_app:
    skip("Task 2 checks skipped, could not create the application")
else:
    task2_app_id = task2_app["id"]
    task2_doc_ids = []

    guarded(
        f"/applications/{task2_app_id}", applicant_token,
        lambda: call("PATCH", f"/applications/submit/{task2_app_id}", token=applicant_token, expect=200,
                     label="applicant submits task-2 application"),
        "submit task-2 application",
    )

    for doc_type in ("PAN_CARD", "SALARY_SLIP", "ADDRESS_PROOF"):
        # application/pdf, not text/plain - featuresTodo.csv task 10's content-type allow-list
        # rejects text/plain now.
        files = {"file": (f"{doc_type.lower()}.pdf", io.BytesIO(b"%PDF-1.4 dummy file contents"), "application/pdf")}
        data = {"documentType": doc_type}
        r = call("POST", f"/applications/{task2_app_id}/documents", token=applicant_token,
                  files=files, data=data, expect=201, label=f"upload {doc_type} for task-2 application")
        if r.ok:
            task2_doc_ids.append(r.json()["id"])

    guarded(
        # existence-checked with admin_token, not processor_token: the processor has no read
        # access to this application until *after* they claim it (that's the Task 4 ownership
        # gate), so checking with their own token would always look like "not found" and skip
        # the claim entirely.
        f"/applications/{task2_app_id}", admin_token,
        lambda: call("POST", f"/processor/claim/{task2_app_id}", token=processor_token, expect=200,
                     label="processor claims task-2 application"),
        "claim task-2 application (processor)",
    )
    # verifyApplication() now requires every required document to be individually VERIFIED,
    # not just present and not-REJECTED (featuresTodo.csv task 5) - mark them before verifying.
    for doc_id in task2_doc_ids:
        guarded(
            f"/documents/{doc_id}", admin_token,
            lambda doc_id=doc_id: call("PATCH", f"/documents/{doc_id}", token=processor_token,
                         json={"verificationStatus": "VERIFIED"}, expect=200,
                         label=f"mark task-2 document {doc_id} VERIFIED"),
            f"mark task-2 document {doc_id} VERIFIED",
        )
    guarded(
        f"/applications/{task2_app_id}", admin_token,
        lambda: call("POST", f"/processor/applications/{task2_app_id}/verify", token=processor_token, expect=200,
                     label="processor verifies task-2 application"),
        "verify task-2 application",
    )
    r = call("GET", f"/applications/{task2_app_id}", token=processor_token, expect=200,
              label="re-read task-2 application after processor verify")
    if r.ok:
        record(r.json().get("status") == "Verified",
               f"task-2 application status is Verified (got {r.json().get('status')})")

    call("GET", "/underwriter/work-list", expect=401,
         label="unauthenticated reads underwriter work-list (should be unauthorized)")
    call("GET", "/underwriter/work-list", token=applicant_token, expect=403,
         label="applicant reads underwriter work-list (should be forbidden)")
    call("GET", "/underwriter/work-list", token=processor_token, expect=403,
         label="processor reads underwriter work-list (should be forbidden)")
    call("GET", "/underwriter/work-list", token=admin_token, expect=403,
         label="admin reads underwriter work-list (should be forbidden, no role override)")
    r = call("GET", "/underwriter/work-list", token=underwriter_token, expect=200,
              label="underwriter reads work-list")
    if r.ok:
        record(any(a["id"] == task2_app_id for a in page_content(r)), "task-2 application appears in the underwriter work-list")

    call("POST", f"/underwriter/claim/{task2_app_id}", expect=401,
         label="unauthenticated claims as underwriter (should be unauthorized)")
    call("POST", f"/underwriter/claim/{task2_app_id}", token=applicant_token, expect=403,
         label="applicant claims as underwriter (should be forbidden)")
    call("POST", f"/underwriter/claim/{task2_app_id}", token=processor_token, expect=403,
         label="processor claims as underwriter (should be forbidden)")
    call("POST", f"/underwriter/claim/{task2_app_id}", token=admin_token, expect=403,
         label="admin claims as underwriter (should be forbidden, no role override)")
    call("POST", "/underwriter/claim/999999999", token=underwriter_token, expect=404,
         label="underwriter claims a nonexistent application (should be not found)")

    guarded(
        f"/applications/{task2_app_id}", admin_token,
        lambda: call("POST", f"/underwriter/claim/{task2_app_id}", token=underwriter_token, expect=200,
                     label="underwriter claims task-2 application"),
        "claim task-2 application (underwriter)",
    )
    r = call("GET", f"/applications/{task2_app_id}", token=underwriter_token, expect=200,
              label="re-read task-2 application after underwriter claim")
    if r.ok:
        body = r.json()
        record(body.get("status") == "Under Review",
               f"task-2 application status is Under Review (got {body.get('status')})")
        record((body.get("underwriter") or {}).get("id") == underwriter_id,
               "underwriter is assigned on task-2 application")

    call("POST", f"/underwriter/claim/{task2_app_id}", token=underwriter_token, expect=409,
         label="underwriter claims task-2 application again (no longer Verified, should conflict) "
               "- task 6's atomic conditional claim returns 409 for any 'status no longer matches' case")

    for doc_id in task2_doc_ids:
        guarded(
            f"/documents/{doc_id}", admin_token,
            lambda doc_id=doc_id: call("DELETE", f"/documents/{doc_id}", token=admin_token, expect=204,
                         label=f"delete task-2 document {doc_id}"),
            f"delete task-2 document {doc_id}",
        )
    guarded(
        f"/applications/{task2_app_id}", admin_token,
        lambda: call("DELETE", f"/applications/{task2_app_id}", token=admin_token, expect=204,
                     label="delete task-2 application"),
        "delete task-2 application",
    )

# ---------------------------------------------------------------------------
# Task 3: LoanApplicationController.create lockdown - Done
# ---------------------------------------------------------------------------
section("Task 3: LoanApplicationController.create lockdown")

call("POST", "/applications",
     json={"applicant": {"id": applicant_id}, "loanAmount": 100000, "tenureMonths": 12},
     expect=401, label="unauthenticated creates an application (should be unauthorized)")

for label, token in (
    ("processor", processor_token),
    ("underwriter", underwriter_token),
    ("admin", admin_token),
):
    # A fully valid body (backendTodo.csv task 7's @Valid runs during Spring MVC argument
    # resolution, which happens BEFORE @PreAuthorize's AOP interceptor - an invalid body would
    # get 400 before the role check is ever reached) so this isolates the role check itself.
    call("POST", "/applications", token=token,
         json={"applicant": {"id": applicant_id}, "loanAmount": 100000, "tenureMonths": 12,
               "declaredIncome": 40000},
         expect=403, label=f"{label} creates an application (should be forbidden, USER only)")

r = call("POST", "/applications", token=applicant_token,
          json={
              "applicant": {"id": processor_id},
              "loanAmount": 400000, "tenureMonths": 12, "declaredIncome": 60000,
              "status": "Ready for Underwriter",
              "creditScore": 800, "verifiedIncome": 999999,
              "recommendation": "APPROVE", "recommendationReason": "forged",
              "decision": "APPROVED", "decisionComments": "forged",
              "processor": {"id": processor_id}, "underwriter": {"id": underwriter_id},
          },
          expect=201, label="applicant creates application with forged staff/decision fields")
task3_app = r.json() if r.ok else None

if not task3_app:
    skip("Task 3 field-stripping checks skipped, could not create the application")
else:
    task3_app_id = task3_app["id"]
    record((task3_app.get("applicant") or {}).get("id") == applicant_id,
           "applicant is forced to the caller, ignoring the forged applicant id in the body")
    record(task3_app.get("status") == "Draft",
           f"status is forced to Draft (got {task3_app.get('status')})")
    for field in ("creditScore", "verifiedIncome", "recommendation", "recommendationReason",
                  "decision", "decisionComments", "processor", "underwriter"):
        record(task3_app.get(field) is None, f"{field} is stripped to null (got {task3_app.get(field)!r})")

    guarded(
        f"/applications/{task3_app_id}", admin_token,
        lambda: call("DELETE", f"/applications/{task3_app_id}", token=admin_token, expect=204,
                     label="delete task-3 application"),
        "delete task-3 application",
    )

# ---------------------------------------------------------------------------
# Task 4: LoanApplicationController reads lockdown - Done
# ---------------------------------------------------------------------------
section("Task 4: LoanApplicationController reads lockdown")

r = call("POST", "/applications", token=applicant_token,
          json={"applicant": {"id": applicant_id}, "loanAmount": 250000,
                "tenureMonths": 24, "declaredIncome": 55000},
          expect=201, label="applicant creates task-4 application")
task4_app = r.json() if r.ok else None

if not task4_app:
    skip("Task 4 checks skipped, could not create the application")
else:
    task4_app_id = task4_app["id"]
    task4_number = task4_app["applicationNumber"]
    task4_doc_ids = []

    # --- before any staff are assigned: only the owner and admin can see it ---
    call("GET", f"/applications/{task4_app_id}", expect=401,
         label="unauthenticated reads task-4 application (should be unauthorized)")
    call("GET", f"/applications/{task4_app_id}", token=applicant_token, expect=200,
         label="owning applicant reads task-4 application")
    call("GET", f"/applications/{task4_app_id}", token=applicant2_token, expect=403,
         label="unrelated applicant2 reads task-4 application (should be forbidden)")
    call("GET", f"/applications/{task4_app_id}", token=processor_token, expect=403,
         label="processor (not yet assigned) reads task-4 application (should be forbidden)")
    call("GET", f"/applications/{task4_app_id}", token=underwriter_token, expect=403,
         label="underwriter (not yet assigned) reads task-4 application (should be forbidden)")
    call("GET", f"/applications/{task4_app_id}", token=admin_token, expect=200,
         label="admin reads task-4 application (sees everything)")
    call("GET", "/applications/999999999", token=admin_token, expect=404,
         label="admin reads a nonexistent application (should be not found)")

    call("GET", f"/applications/application-number/{task4_number}", token=applicant_token, expect=200,
         label="owning applicant reads task-4 application by application number")
    call("GET", f"/applications/application-number/{task4_number}", token=applicant2_token, expect=403,
         label="unrelated applicant2 reads task-4 application by application number (should be forbidden)")
    call("GET", "/applications/application-number/NO-SUCH-NUMBER", token=applicant_token, expect=404,
         label="application number that doesn't exist (should be not found)")

    # --- list(): non-admin callers are always scoped to their own, regardless of params ---
    r = call("GET", "/applications", token=applicant_token, expect=200, label="applicant lists applications")
    record(r.ok and any(a["id"] == task4_app_id for a in page_content(r)),
           "task-4 application appears in the owning applicant's list")
    r = call("GET", "/applications", token=applicant2_token, expect=200, label="applicant2 lists applications")
    record(r.ok and not any(a["id"] == task4_app_id for a in page_content(r)),
           "task-4 application does not appear in an unrelated applicant's list")
    r = call("GET", "/applications", token=applicant2_token, params={"applicantId": applicant_id}, expect=200,
              label="applicant2 lists applications, trying to impersonate applicantId in the query")
    record(r.ok and not any(a["id"] == task4_app_id for a in page_content(r)),
           "applicantId query param can't be used to see someone else's applications - forced to the caller")
    call("GET", "/applications", expect=401, label="unauthenticated lists applications (should be unauthorized)")

    # --- assign processor, re-check ownership boundary between processor and processor2 ---
    guarded(
        f"/applications/{task4_app_id}", applicant_token,
        lambda: call("PATCH", f"/applications/submit/{task4_app_id}", token=applicant_token, expect=200,
                     label="applicant submits task-4 application"),
        "submit task-4 application",
    )
    guarded(
        # existence-checked with admin_token, not processor_token - see the comment on the
        # equivalent task-2 claim above.
        f"/applications/{task4_app_id}", admin_token,
        lambda: call("POST", f"/processor/claim/{task4_app_id}", token=processor_token, expect=200,
                     label="processor claims task-4 application"),
        "claim task-4 application (processor)",
    )

    call("GET", f"/applications/{task4_app_id}", token=processor_token, expect=200,
         label="assigned processor reads task-4 application")
    call("GET", f"/applications/{task4_app_id}", token=processor2_token, expect=403,
         label="unassigned processor2 reads task-4 application (should be forbidden)")
    r = call("GET", "/applications", token=processor_token, expect=200, label="assigned processor lists applications")
    record(r.ok and any(a["id"] == task4_app_id for a in page_content(r)),
           "task-4 application appears in the assigned processor's list")
    r = call("GET", "/applications", token=processor2_token, expect=200, label="unassigned processor2 lists applications")
    record(r.ok and not any(a["id"] == task4_app_id for a in page_content(r)),
           "task-4 application does not appear in an unassigned processor's list")

    for doc_type in ("PAN_CARD", "SALARY_SLIP", "ADDRESS_PROOF"):
        # application/pdf, not text/plain - featuresTodo.csv task 10's content-type allow-list
        # rejects text/plain now.
        files = {"file": (f"{doc_type.lower()}.pdf", io.BytesIO(b"%PDF-1.4 dummy file contents"), "application/pdf")}
        data = {"documentType": doc_type}
        r = call("POST", f"/applications/{task4_app_id}/documents", token=applicant_token,
                  files=files, data=data, expect=201, label=f"upload {doc_type} for task-4 application")
        if r.ok:
            task4_doc_ids.append(r.json()["id"])

    # verifyApplication() now requires every required document to be individually VERIFIED,
    # not just present and not-REJECTED (featuresTodo.csv task 5) - mark them before verifying.
    for doc_id in task4_doc_ids:
        guarded(
            f"/documents/{doc_id}", admin_token,
            lambda doc_id=doc_id: call("PATCH", f"/documents/{doc_id}", token=processor_token,
                         json={"verificationStatus": "VERIFIED"}, expect=200,
                         label=f"mark task-4 document {doc_id} VERIFIED"),
            f"mark task-4 document {doc_id} VERIFIED",
        )
    guarded(
        f"/applications/{task4_app_id}", admin_token,
        lambda: call("POST", f"/processor/applications/{task4_app_id}/verify", token=processor_token, expect=200,
                     label="processor verifies task-4 application"),
        "verify task-4 application",
    )

    # --- assign underwriter, re-check ownership boundary between underwriter and underwriter2 ---
    guarded(
        f"/applications/{task4_app_id}", admin_token,
        lambda: call("POST", f"/underwriter/claim/{task4_app_id}", token=underwriter_token, expect=200,
                     label="underwriter claims task-4 application"),
        "claim task-4 application (underwriter)",
    )
    call("GET", f"/applications/{task4_app_id}", token=underwriter_token, expect=200,
         label="assigned underwriter reads task-4 application")
    call("GET", f"/applications/{task4_app_id}", token=underwriter2_token, expect=403,
         label="unassigned underwriter2 reads task-4 application (should be forbidden)")
    r = call("GET", "/applications", token=underwriter_token, expect=200, label="assigned underwriter lists applications")
    record(r.ok and any(a["id"] == task4_app_id for a in page_content(r)),
           "task-4 application appears in the assigned underwriter's list")
    r = call("GET", "/applications", token=underwriter2_token, expect=200, label="unassigned underwriter2 lists applications")
    record(r.ok and not any(a["id"] == task4_app_id for a in page_content(r)),
           "task-4 application does not appear in an unassigned underwriter's list")

    r = call("GET", "/applications", token=admin_token, expect=200, label="admin lists applications")
    record(r.ok and any(a["id"] == task4_app_id for a in page_content(r)), "task-4 application appears in the admin's list")

    for doc_id in task4_doc_ids:
        guarded(
            f"/documents/{doc_id}", admin_token,
            lambda doc_id=doc_id: call("DELETE", f"/documents/{doc_id}", token=admin_token, expect=204,
                         label=f"delete task-4 document {doc_id}"),
            f"delete task-4 document {doc_id}",
        )
    guarded(
        f"/applications/{task4_app_id}", admin_token,
        lambda: call("DELETE", f"/applications/{task4_app_id}", token=admin_token, expect=204,
                     label="delete task-4 application"),
        "delete task-4 application",
    )

# ---------------------------------------------------------------------------
# Task 5: LoanApplicationController.update lockdown - Done
# ---------------------------------------------------------------------------
section("Task 5: LoanApplicationController.update lockdown")

r = call("POST", "/applications", token=applicant_token,
          json={"applicant": {"id": applicant_id}, "loanAmount": 150000,
                "tenureMonths": 12, "declaredIncome": 40000},
          expect=201, label="applicant creates task-5 application")
task5_app = r.json() if r.ok else None

if not task5_app:
    skip("Task 5 checks skipped, could not create the application")
else:
    task5_app_id = task5_app["id"]

    call("PUT", f"/applications/{task5_app_id}", json={"loanAmount": 160000}, expect=401,
         label="unauthenticated updates task-5 application (should be unauthorized)")
    call("PUT", f"/applications/{task5_app_id}", token=applicant2_token, json={"loanAmount": 160000},
         expect=403, label="unrelated applicant2 updates task-5 application (should be forbidden)")
    call("PUT", "/applications/999999999", token=applicant_token, json={"loanAmount": 160000},
         expect=404, label="update a nonexistent application (should be not found)")

    r = call("PUT", f"/applications/{task5_app_id}", token=applicant_token,
              json={"loanAmount": 175000}, expect=200,
              label="owning applicant updates task-5 application while Draft")
    record(r.ok and float(r.json().get("loanAmount", 0)) == 175000.0,
           "loanAmount update actually persisted")

    r = call("PUT", f"/applications/{task5_app_id}", token=applicant_token,
              json={"status": "Submitted"}, expect=200,
              label="owning applicant tries to set status directly via update (still Draft)")
    record(r.ok and r.json().get("status") == "Draft",
           f"status change is ignored, still Draft (got {r.json().get('status') if r.ok else None})")

    guarded(
        f"/applications/{task5_app_id}", applicant_token,
        lambda: call("PATCH", f"/applications/submit/{task5_app_id}", token=applicant_token, expect=200,
                     label="applicant submits task-5 application"),
        "submit task-5 application",
    )

    call("PUT", f"/applications/{task5_app_id}", token=applicant_token, json={"loanAmount": 180000},
         expect=403, label="owning applicant updates task-5 application after submit (should be forbidden)")

    guarded(
        f"/applications/{task5_app_id}", admin_token,
        lambda: call("POST", f"/processor/claim/{task5_app_id}", token=processor_token, expect=200,
                     label="processor claims task-5 application"),
        "claim task-5 application (processor)",
    )

    # verifiedIncome, not interestRate, proves the write actually persists here - interestRate
    # is force-set to a fixed backend constant regardless of caller input as of
    # todo/featuresTodo.csv task 3, so it's no longer a usable passthrough-persistence probe.
    call("PUT", f"/applications/{task5_app_id}", token=processor2_token, json={"verifiedIncome": 42000},
         expect=403, label="unassigned processor2 updates task-5 application (should be forbidden)")
    r = call("PUT", f"/applications/{task5_app_id}", token=processor_token, json={"verifiedIncome": 42000},
              expect=200, label="assigned processor updates task-5 application after submit")
    record(r.ok and float(r.json().get("verifiedIncome", 0)) == 42000, "verifiedIncome update actually persisted")

    r = call("PUT", f"/applications/{task5_app_id}", token=admin_token,
              json={"underwriter": {"id": underwriter_id}}, expect=200,
              label="admin updates task-5 application (assigns underwriter)")
    record(r.ok and (r.json().get("underwriter") or {}).get("id") == underwriter_id,
           "admin update actually persisted")

    guarded(
        f"/applications/{task5_app_id}", admin_token,
        lambda: call("DELETE", f"/applications/{task5_app_id}", token=admin_token, expect=204,
                     label="delete task-5 application"),
        "delete task-5 application",
    )

# ---------------------------------------------------------------------------
# Task 6: submit / withdraw lockdown - Done
# ---------------------------------------------------------------------------
section("Task 6: submit / withdraw lockdown")

r = call("POST", "/applications", token=applicant_token,
          json={"applicant": {"id": applicant_id}, "loanAmount": 120000,
                "tenureMonths": 12, "declaredIncome": 35000},
          expect=201, label="applicant creates task-6 application")
task6_app = r.json() if r.ok else None

if not task6_app:
    skip("Task 6 checks skipped, could not create the application")
else:
    task6_app_id = task6_app["id"]

    call("PATCH", f"/applications/submit/{task6_app_id}", expect=401,
         label="unauthenticated submits task-6 application (should be unauthorized)")
    call("PATCH", f"/applications/submit/{task6_app_id}", token=applicant2_token, expect=403,
         label="unrelated applicant2 submits task-6 application (should be forbidden)")
    call("PATCH", f"/applications/submit/{task6_app_id}", token=processor_token, expect=403,
         label="processor submits task-6 application (should be forbidden, no staff access)")
    call("PATCH", f"/applications/submit/{task6_app_id}", token=admin_token, expect=403,
         label="admin submits task-6 application (should be forbidden, no admin override)")
    call("PATCH", "/applications/submit/999999999", token=applicant_token, expect=404,
         label="submit a nonexistent application (should be not found)")

    r = call("PATCH", f"/applications/submit/{task6_app_id}", token=applicant_token, expect=200,
              label="owning applicant submits task-6 application")
    record(r.ok and r.json().get("status") == "Submitted",
           f"task-6 application status is Submitted (got {r.json().get('status') if r.ok else None})")

    call("PATCH", f"/applications/withdraw/{task6_app_id}", expect=401,
         label="unauthenticated withdraws task-6 application (should be unauthorized)")
    call("PATCH", f"/applications/withdraw/{task6_app_id}", token=applicant2_token, expect=403,
         label="unrelated applicant2 withdraws task-6 application (should be forbidden)")
    call("PATCH", f"/applications/withdraw/{task6_app_id}", token=processor_token, expect=403,
         label="processor withdraws task-6 application (should be forbidden, no staff access)")
    call("PATCH", f"/applications/withdraw/{task6_app_id}", token=admin_token, expect=403,
         label="admin withdraws task-6 application (should be forbidden, no admin override)")
    call("PATCH", "/applications/withdraw/999999999", token=applicant_token, expect=404,
         label="withdraw a nonexistent application (should be not found)")

    r = call("PATCH", f"/applications/withdraw/{task6_app_id}", token=applicant_token, expect=200,
              label="owning applicant withdraws task-6 application")
    record(r.ok and r.json().get("status") == "Withdrawn",
           f"task-6 application status is Withdrawn (got {r.json().get('status') if r.ok else None})")

    guarded(
        f"/applications/{task6_app_id}", admin_token,
        lambda: call("DELETE", f"/applications/{task6_app_id}", token=admin_token, expect=204,
                     label="delete task-6 application"),
        "delete task-6 application",
    )

# ---------------------------------------------------------------------------
# Task 7: delete application lockdown (ADMIN only) - Done
# ---------------------------------------------------------------------------
section("Task 7: delete application lockdown")

r = call("POST", "/applications", token=applicant_token,
          json={"applicant": {"id": applicant_id}, "loanAmount": 90000,
                "tenureMonths": 12, "declaredIncome": 30000},
          expect=201, label="applicant creates task-7 application")
task7_app = r.json() if r.ok else None

if not task7_app:
    skip("Task 7 checks skipped, could not create the application")
else:
    task7_app_id = task7_app["id"]

    call("DELETE", f"/applications/{task7_app_id}", expect=401,
         label="unauthenticated deletes task-7 application (should be unauthorized)")
    call("DELETE", f"/applications/{task7_app_id}", token=applicant_token, expect=403,
         label="owning applicant deletes task-7 application (should be forbidden, ADMIN only)")
    call("DELETE", f"/applications/{task7_app_id}", token=processor_token, expect=403,
         label="processor deletes task-7 application (should be forbidden, ADMIN only)")
    call("DELETE", f"/applications/{task7_app_id}", token=underwriter_token, expect=403,
         label="underwriter deletes task-7 application (should be forbidden, ADMIN only)")
    call("DELETE", "/applications/999999999", token=admin_token, expect=404,
         label="admin deletes a nonexistent application (should be not found)")

    call("DELETE", f"/applications/{task7_app_id}", token=admin_token, expect=204,
         label="admin deletes task-7 application")
    call("GET", f"/applications/{task7_app_id}", token=admin_token, expect=404,
         label="task-7 application no longer retrievable after delete")

# ---------------------------------------------------------------------------
# Task 8: document upload/list under /applications/{id}/documents - Not Started
# ---------------------------------------------------------------------------
section("Task 8: document upload/list lockdown")

r = call("POST", "/applications", token=applicant_token,
          json={"applicant": {"id": applicant_id}, "loanAmount": 130000,
                "tenureMonths": 12, "declaredIncome": 42000},
          expect=201, label="applicant creates task-8 application")
task8_app = r.json() if r.ok else None

if not task8_app:
    skip("Task 8 checks skipped, could not create the application")
else:
    task8_app_id = task8_app["id"]
    task8_doc_ids = []

    def upload(token, doc_type, expect, label):
        # application/pdf, not text/plain - featuresTodo.csv task 10's content-type allow-list
        # rejects text/plain now.
        files = {"file": (f"{doc_type.lower()}.pdf", io.BytesIO(b"%PDF-1.4 dummy file contents"), "application/pdf")}
        data = {"documentType": doc_type}
        r = call("POST", f"/applications/{task8_app_id}/documents", token=token,
                  files=files, data=data, expect=expect, label=label)
        if r.ok:
            task8_doc_ids.append(r.json()["id"])
        return r

    upload(None, "PAN_CARD", 401, "unauthenticated uploads to task-8 application (should be unauthorized)")
    upload(applicant2_token, "PAN_CARD", 403,
           "unrelated applicant2 uploads to task-8 application (should be forbidden)")
    upload(applicant_token, "PAN_CARD", 201, "owning applicant uploads PAN_CARD for task-8 application")

    call("GET", f"/applications/{task8_app_id}/documents", expect=401,
         label="unauthenticated lists task-8 application documents (should be unauthorized)")
    call("GET", f"/applications/{task8_app_id}/documents", token=applicant2_token, expect=403,
         label="unrelated applicant2 lists task-8 application documents (should be forbidden)")
    r = call("GET", f"/applications/{task8_app_id}/documents", token=applicant_token, expect=200,
              label="owning applicant lists task-8 application documents")
    if r.ok:
        body = r.json()
        record(len(body.get("documents", [])) == 1, "exactly 1 document uploaded so far")
        record(set(body.get("missingRequiredDocuments", [])) == {"SALARY_SLIP", "ADDRESS_PROOF"},
               f"missing docs are SALARY_SLIP/ADDRESS_PROOF (got {body.get('missingRequiredDocuments')})")

    call("POST", f"/applications/999999999/documents", token=applicant_token,
         files={"file": ("x.txt", io.BytesIO(b"x"), "text/plain")}, data={"documentType": "OTHER"},
         expect=404, label="upload to a nonexistent application (should be not found)")
    call("GET", "/applications/999999999/documents", token=applicant_token, expect=404,
         label="list documents for a nonexistent application (should be not found)")

    guarded(
        f"/applications/{task8_app_id}", applicant_token,
        lambda: call("PATCH", f"/applications/submit/{task8_app_id}", token=applicant_token, expect=200,
                     label="applicant submits task-8 application"),
        "submit task-8 application",
    )
    guarded(
        f"/applications/{task8_app_id}", admin_token,
        lambda: call("POST", f"/processor/claim/{task8_app_id}", token=processor_token, expect=200,
                     label="processor claims task-8 application"),
        "claim task-8 application (processor)",
    )

    upload(processor2_token, "SALARY_SLIP", 403,
           "unassigned processor2 uploads to task-8 application (should be forbidden)")
    call("GET", f"/applications/{task8_app_id}/documents", token=processor2_token, expect=403,
         label="unassigned processor2 lists task-8 application documents (should be forbidden)")
    upload(processor_token, "SALARY_SLIP", 201, "assigned processor uploads SALARY_SLIP for task-8 application")
    upload(applicant_token, "ADDRESS_PROOF", 201, "owning applicant uploads ADDRESS_PROOF for task-8 application")
    r = call("GET", f"/applications/{task8_app_id}/documents", token=processor_token, expect=200,
              label="assigned processor lists task-8 application documents")
    if r.ok:
        record(len(r.json().get("documents", [])) == 3, "all 3 documents visible to the assigned processor")

    # verifyApplication() now requires every required document to be individually VERIFIED,
    # not just present and not-REJECTED (featuresTodo.csv task 5) - mark them before verifying.
    for doc_id in task8_doc_ids:
        guarded(
            f"/documents/{doc_id}", admin_token,
            lambda doc_id=doc_id: call("PATCH", f"/documents/{doc_id}", token=processor_token,
                         json={"verificationStatus": "VERIFIED"}, expect=200,
                         label=f"mark task-8 document {doc_id} VERIFIED"),
            f"mark task-8 document {doc_id} VERIFIED",
        )
    guarded(
        f"/applications/{task8_app_id}", admin_token,
        lambda: call("POST", f"/processor/applications/{task8_app_id}/verify", token=processor_token, expect=200,
                     label="processor verifies task-8 application"),
        "verify task-8 application",
    )
    guarded(
        f"/applications/{task8_app_id}", admin_token,
        lambda: call("POST", f"/underwriter/claim/{task8_app_id}", token=underwriter_token, expect=200,
                     label="underwriter claims task-8 application"),
        "claim task-8 application (underwriter)",
    )

    call("GET", f"/applications/{task8_app_id}/documents", token=underwriter2_token, expect=403,
         label="unassigned underwriter2 lists task-8 application documents (should be forbidden)")
    r = call("GET", f"/applications/{task8_app_id}/documents", token=underwriter_token, expect=200,
              label="assigned underwriter lists task-8 application documents")
    record(r.ok and len(r.json().get("documents", [])) == 3,
           "all 3 documents visible to the assigned underwriter")
    r = call("GET", f"/applications/{task8_app_id}/documents", token=admin_token, expect=200,
              label="admin lists task-8 application documents")
    record(r.ok and len(r.json().get("documents", [])) == 3, "all 3 documents visible to admin")

    for doc_id in task8_doc_ids:
        guarded(
            f"/documents/{doc_id}", admin_token,
            lambda doc_id=doc_id: call("DELETE", f"/documents/{doc_id}", token=admin_token, expect=204,
                         label=f"delete task-8 document {doc_id}"),
            f"delete task-8 document {doc_id}",
        )
    guarded(
        f"/applications/{task8_app_id}", admin_token,
        lambda: call("DELETE", f"/applications/{task8_app_id}", token=admin_token, expect=204,
                     label="delete task-8 application"),
        "delete task-8 application",
    )

# ---------------------------------------------------------------------------
# Task 9: DocumentController reads lockdown - Not Started
# ---------------------------------------------------------------------------
section("Task 9: DocumentController reads lockdown")

r = call("POST", "/applications", token=applicant_token,
          json={"applicant": {"id": applicant_id}, "loanAmount": 140000,
                "tenureMonths": 12, "declaredIncome": 48000},
          expect=201, label="applicant creates task-9 application")
task9_app = r.json() if r.ok else None

if not task9_app:
    skip("Task 9 checks skipped, could not create the application")
else:
    task9_app_id = task9_app["id"]
    task9_doc_ids = []

    r = call("POST", "/documents", token=admin_token,
              json={"application": {"id": task9_app_id}, "documentType": "OTHER",
                    "verificationStatus": "PENDING"},
              expect=201, label="admin creates a document on task-9 application")
    task9_doc_id = r.json().get("id") if r.ok else None
    if task9_doc_id:
        task9_doc_ids.append(task9_doc_id)

    call("GET", f"/documents/{task9_doc_id}", expect=401,
         label="unauthenticated reads task-9 document (should be unauthorized)")
    call("GET", f"/documents/{task9_doc_id}", token=applicant2_token, expect=403,
         label="unrelated applicant2 reads task-9 document (should be forbidden)")
    call("GET", f"/documents/{task9_doc_id}", token=processor_token, expect=403,
         label="processor (not yet assigned) reads task-9 document (should be forbidden)")
    call("GET", f"/documents/{task9_doc_id}", token=applicant_token, expect=200,
         label="owning applicant reads task-9 document")
    call("GET", f"/documents/{task9_doc_id}", token=admin_token, expect=200,
         label="admin reads task-9 document")
    call("GET", "/documents/999999999", token=admin_token, expect=404,
         label="admin reads a nonexistent document (should be not found)")

    call("GET", "/documents", expect=401, label="unauthenticated lists documents (should be unauthorized)")
    r = call("GET", "/documents", token=applicant2_token, expect=200, label="applicant2 lists documents")
    record(r.ok and not any(d["id"] == task9_doc_id for d in page_content(r)),
           "task-9 document does not appear in an unrelated applicant's document list")
    r = call("GET", "/documents", token=applicant_token, expect=200, label="owning applicant lists documents")
    record(r.ok and any(d["id"] == task9_doc_id for d in page_content(r)),
           "task-9 document appears in the owning applicant's document list")
    r = call("GET", "/documents", token=admin_token, expect=200, label="admin lists documents")
    record(r.ok and any(d["id"] == task9_doc_id for d in page_content(r)),
           "task-9 document appears in the admin's document list")

    for doc_type in ("PAN_CARD", "SALARY_SLIP", "ADDRESS_PROOF"):
        # application/pdf, not text/plain - featuresTodo.csv task 10's content-type allow-list
        # rejects text/plain now.
        files = {"file": (f"{doc_type.lower()}.pdf", io.BytesIO(b"%PDF-1.4 dummy file contents"), "application/pdf")}
        data = {"documentType": doc_type}
        r = call("POST", f"/applications/{task9_app_id}/documents", token=applicant_token,
                  files=files, data=data, expect=201, label=f"upload {doc_type} for task-9 application")
        if r.ok:
            task9_doc_ids.append(r.json()["id"])

    guarded(
        f"/applications/{task9_app_id}", applicant_token,
        lambda: call("PATCH", f"/applications/submit/{task9_app_id}", token=applicant_token, expect=200,
                     label="applicant submits task-9 application"),
        "submit task-9 application",
    )
    guarded(
        f"/applications/{task9_app_id}", admin_token,
        lambda: call("POST", f"/processor/claim/{task9_app_id}", token=processor_token, expect=200,
                     label="processor claims task-9 application"),
        "claim task-9 application (processor)",
    )

    call("GET", f"/documents/{task9_doc_id}", token=processor_token, expect=200,
         label="assigned processor reads task-9 document")
    call("GET", f"/documents/{task9_doc_id}", token=processor2_token, expect=403,
         label="unassigned processor2 reads task-9 document (should be forbidden)")
    r = call("GET", "/documents", token=processor_token, expect=200, label="assigned processor lists documents")
    record(r.ok and any(d["id"] == task9_doc_id for d in page_content(r)),
           "task-9 document appears in the assigned processor's document list")
    r = call("GET", "/documents", token=processor2_token, expect=200, label="unassigned processor2 lists documents")
    record(r.ok and not any(d["id"] == task9_doc_id for d in page_content(r)),
           "task-9 document does not appear in an unassigned processor's document list")

    # verifyApplication() now requires every required document to be individually VERIFIED,
    # not just present and not-REJECTED (featuresTodo.csv task 5) - mark them before verifying.
    for doc_id in task9_doc_ids:
        guarded(
            f"/documents/{doc_id}", admin_token,
            lambda doc_id=doc_id: call("PATCH", f"/documents/{doc_id}", token=processor_token,
                         json={"verificationStatus": "VERIFIED"}, expect=200,
                         label=f"mark task-9 document {doc_id} VERIFIED"),
            f"mark task-9 document {doc_id} VERIFIED",
        )
    guarded(
        f"/applications/{task9_app_id}", admin_token,
        lambda: call("POST", f"/processor/applications/{task9_app_id}/verify", token=processor_token, expect=200,
                     label="processor verifies task-9 application"),
        "verify task-9 application",
    )
    guarded(
        f"/applications/{task9_app_id}", admin_token,
        lambda: call("POST", f"/underwriter/claim/{task9_app_id}", token=underwriter_token, expect=200,
                     label="underwriter claims task-9 application"),
        "claim task-9 application (underwriter)",
    )

    call("GET", f"/documents/{task9_doc_id}", token=underwriter_token, expect=200,
         label="assigned underwriter reads task-9 document")
    call("GET", f"/documents/{task9_doc_id}", token=underwriter2_token, expect=403,
         label="unassigned underwriter2 reads task-9 document (should be forbidden)")
    r = call("GET", "/documents", token=underwriter_token, expect=200, label="assigned underwriter lists documents")
    record(r.ok and any(d["id"] == task9_doc_id for d in page_content(r)),
           "task-9 document appears in the assigned underwriter's document list")
    r = call("GET", "/documents", token=underwriter2_token, expect=200, label="unassigned underwriter2 lists documents")
    record(r.ok and not any(d["id"] == task9_doc_id for d in page_content(r)),
           "task-9 document does not appear in an unassigned underwriter's document list")

    for doc_id in task9_doc_ids:
        guarded(
            f"/documents/{doc_id}", admin_token,
            lambda doc_id=doc_id: call("DELETE", f"/documents/{doc_id}", token=admin_token, expect=204,
                         label=f"delete task-9 document {doc_id}"),
            f"delete task-9 document {doc_id}",
        )
    guarded(
        f"/applications/{task9_app_id}", admin_token,
        lambda: call("DELETE", f"/applications/{task9_app_id}", token=admin_token, expect=204,
                     label="delete task-9 application"),
        "delete task-9 application",
    )

# ---------------------------------------------------------------------------
# Task 9b: DocumentController.create ADMIN-only - Done
# ---------------------------------------------------------------------------
section("Task 9b: DocumentController.create is ADMIN only")

call("POST", "/documents",
     json={"application": {"id": base_app_id}, "documentType": "OTHER",
           "verificationStatus": "VERIFIED"},
     expect=401, label="unauthenticated calls POST /documents (should be unauthorized)")

for label, token in (
    ("applicant", applicant_token),
    ("processor", processor_token),
    ("underwriter", underwriter_token),
):
    call("POST", "/documents", token=token,
         json={"application": {"id": base_app_id}, "documentType": "OTHER",
               "verificationStatus": "VERIFIED"},
         expect=403, label=f"{label} calls POST /documents (should be forbidden, ADMIN only)")

r = call("POST", "/documents", token=admin_token,
          json={"application": {"id": base_app_id}, "documentType": "OTHER",
                "verificationStatus": "PENDING"},
          expect=201, label="admin calls POST /documents")
admin_created_doc_id = r.json().get("id") if r.ok else None

# ---------------------------------------------------------------------------
# Task 9c: DocumentController.update PROCESSOR/UNDERWRITER/ADMIN only - Done.
# Updated for backendTodo.csv task 1 ("Done"): this endpoint is no longer
# role-only - it now also requires the caller be the assigned processor/
# underwriter on the document's application (admin still has no such
# restriction). None of processor/processor2/underwriter below are assigned
# to task9c_app (nobody claims it in this section), so all three now get
# 403 where they used to get 200 - see backendTodoTest/task01_document_put_ownership.py
# for the full positive (assigned-caller-succeeds) coverage.
# ---------------------------------------------------------------------------
section("Task 9c: DocumentController.update lockdown")

r = call("POST", "/applications", token=applicant_token,
          json={"applicant": {"id": applicant_id}, "loanAmount": 110000,
                "tenureMonths": 12, "declaredIncome": 38000},
          expect=201, label="applicant creates task-9c application")
task9c_app = r.json() if r.ok else None

if not task9c_app:
    skip("Task 9c checks skipped, could not create the application")
else:
    task9c_app_id = task9c_app["id"]
    r = call("POST", "/documents", token=admin_token,
              json={"application": {"id": task9c_app_id}, "documentType": "OTHER",
                    "verificationStatus": "PENDING"},
              expect=201, label="admin creates a document on task-9c application")
    task9c_doc_id = r.json().get("id") if r.ok else None

    call("PUT", f"/documents/{task9c_doc_id}", json={"remarks": "x"}, expect=401,
         label="unauthenticated updates task-9c document (should be unauthorized)")
    call("PUT", f"/documents/{task9c_doc_id}", token=applicant_token, json={"remarks": "x"},
         expect=403, label="owning applicant updates task-9c document (should be forbidden, no applicant access)")
    call("PUT", "/documents/999999999", token=admin_token, json={"remarks": "x"},
         expect=404, label="update a nonexistent document (should be not found)")

    call("PUT", f"/documents/{task9c_doc_id}", token=processor_token,
         json={"remarks": "processor remarks"}, expect=403,
         label="unassigned processor updates task-9c document (backendTodo task 1: ownership-checked now)")
    call("PUT", f"/documents/{task9c_doc_id}", token=processor2_token,
         json={"remarks": "processor2 remarks"}, expect=403,
         label="unassigned processor2 updates task-9c document (backendTodo task 1: ownership-checked now)")
    call("PUT", f"/documents/{task9c_doc_id}", token=underwriter_token,
         json={"remarks": "underwriter remarks"}, expect=403,
         label="unassigned underwriter updates task-9c document (backendTodo task 1: ownership-checked now)")
    r = call("PUT", f"/documents/{task9c_doc_id}", token=admin_token,
              json={"remarks": "admin remarks"}, expect=200,
              label="admin updates task-9c document (admin has no ownership restriction)")
    record(r.ok and r.json().get("remarks") == "admin remarks", "admin's update actually persisted")

    guarded(
        f"/documents/{task9c_doc_id}", admin_token,
        lambda: call("DELETE", f"/documents/{task9c_doc_id}", token=admin_token, expect=204,
                     label="delete task-9c document"),
        "delete task-9c document",
    )
    guarded(
        f"/applications/{task9c_app_id}", admin_token,
        lambda: call("DELETE", f"/applications/{task9c_app_id}", token=admin_token, expect=204,
                     label="delete task-9c application"),
        "delete task-9c application",
    )

# ---------------------------------------------------------------------------
# Task 9d: DocumentController.delete conditional PENDING/ADMIN rule - Not Started
# ---------------------------------------------------------------------------
section("Task 9d: DocumentController.delete lockdown")

r = call("POST", "/applications", token=applicant_token,
          json={"applicant": {"id": applicant_id}, "loanAmount": 95000,
                "tenureMonths": 12, "declaredIncome": 33000},
          expect=201, label="applicant creates task-9d application")
task9d_app = r.json() if r.ok else None

if not task9d_app:
    skip("Task 9d checks skipped, could not create the application")
else:
    task9d_app_id = task9d_app["id"]

    r = call("POST", "/documents", token=admin_token,
              json={"application": {"id": task9d_app_id}, "documentType": "OTHER",
                    "verificationStatus": "PENDING"},
              expect=201, label="admin creates a PENDING document on task-9d application")
    pending_doc_id = r.json().get("id") if r.ok else None

    r = call("POST", "/documents", token=admin_token,
              json={"application": {"id": task9d_app_id}, "documentType": "OTHER",
                    "verificationStatus": "VERIFIED"},
              expect=201, label="admin creates a VERIFIED document on task-9d application")
    verified_doc_id = r.json().get("id") if r.ok else None

    # --- PENDING document: owning applicant may delete it themselves ---
    call("DELETE", f"/documents/{pending_doc_id}", expect=401,
         label="unauthenticated deletes PENDING task-9d document (should be unauthorized)")
    call("DELETE", f"/documents/{pending_doc_id}", token=applicant2_token, expect=403,
         label="unrelated applicant2 deletes PENDING task-9d document (should be forbidden)")
    call("DELETE", f"/documents/{pending_doc_id}", token=processor_token, expect=403,
         label="processor deletes PENDING task-9d document (should be forbidden, no staff delete access)")
    call("DELETE", f"/documents/{pending_doc_id}", token=applicant_token, expect=204,
         label="owning applicant deletes their own PENDING task-9d document")
    call("GET", f"/documents/{pending_doc_id}", token=admin_token, expect=404,
         label="PENDING task-9d document no longer retrievable after delete")

    # --- VERIFIED document: no longer PENDING, owning applicant is blocked, only admin can ---
    call("DELETE", f"/documents/{verified_doc_id}", token=applicant_token, expect=403,
         label="owning applicant deletes VERIFIED task-9d document (should be forbidden, not PENDING anymore)")
    call("DELETE", f"/documents/{verified_doc_id}", token=processor_token, expect=403,
         label="processor deletes VERIFIED task-9d document (should be forbidden, no staff delete access)")
    call("DELETE", f"/documents/{verified_doc_id}", token=admin_token, expect=204,
         label="admin deletes VERIFIED task-9d document")
    call("GET", f"/documents/{verified_doc_id}", token=admin_token, expect=404,
         label="VERIFIED task-9d document no longer retrievable after delete")

    call("DELETE", "/documents/999999999", token=admin_token, expect=404,
         label="admin deletes a nonexistent document (should be not found)")

    guarded(
        f"/applications/{task9d_app_id}", admin_token,
        lambda: call("DELETE", f"/applications/{task9d_app_id}", token=admin_token, expect=204,
                     label="delete task-9d application"),
        "delete task-9d application",
    )

# ---------------------------------------------------------------------------
# Task 10: ApplicationHistoryController create/update/delete lockdown - Not Started
# ---------------------------------------------------------------------------
section("Task 10: ApplicationHistoryController write lockdown")

r = call("POST", "/applications", token=applicant_token,
          json={"applicant": {"id": applicant_id}, "loanAmount": 105000,
                "tenureMonths": 12, "declaredIncome": 36000},
          expect=201, label="applicant creates task-10 application")
task10_app = r.json() if r.ok else None

if not task10_app:
    skip("Task 10 checks skipped, could not create the application")
else:
    task10_app_id = task10_app["id"]

    call("POST", "/application-history",
         json={"application": {"id": task10_app_id}, "user": {"id": applicant_id},
               "action": "NOTE", "details": "x"},
         expect=401, label="unauthenticated creates a history entry (should be unauthorized)")
    for label, token in (("applicant", applicant_token), ("processor", processor_token),
                         ("underwriter", underwriter_token)):
        call("POST", "/application-history", token=token,
             json={"application": {"id": task10_app_id}, "user": {"id": applicant_id},
                   "action": "NOTE", "details": "x"},
             expect=403, label=f"{label} creates a history entry (should be forbidden, ADMIN only)")

    r = call("POST", "/application-history", token=admin_token,
              json={"application": {"id": task10_app_id}, "user": {"id": applicant_id},
                    "action": "NOTE", "details": "created by admin"},
              expect=201, label="admin creates a history entry")
    task10_history_id = r.json().get("id") if r.ok else None

    call("PUT", f"/application-history/{task10_history_id}",
         json={"details": "updated"}, expect=401,
         label="unauthenticated updates the history entry (should be unauthorized)")
    for label, token in (("applicant", applicant_token), ("processor", processor_token),
                         ("underwriter", underwriter_token)):
        call("PUT", f"/application-history/{task10_history_id}", token=token,
             json={"details": "updated"}, expect=403,
             label=f"{label} updates the history entry (should be forbidden, ADMIN only)")
    call("PUT", f"/application-history/{task10_history_id}", token=admin_token,
         json={"details": "updated by admin"}, expect=200, label="admin updates the history entry")
    call("PUT", "/application-history/999999999", token=admin_token,
         json={"details": "x"}, expect=404, label="update a nonexistent history entry (should be not found)")

    call("DELETE", f"/application-history/{task10_history_id}", expect=401,
         label="unauthenticated deletes the history entry (should be unauthorized)")
    for label, token in (("applicant", applicant_token), ("processor", processor_token),
                         ("underwriter", underwriter_token)):
        call("DELETE", f"/application-history/{task10_history_id}", token=token, expect=403,
             label=f"{label} deletes the history entry (should be forbidden, ADMIN only)")
    call("DELETE", f"/application-history/{task10_history_id}", token=admin_token, expect=204,
         label="admin deletes the history entry")
    call("DELETE", "/application-history/999999999", token=admin_token, expect=404,
         label="delete a nonexistent history entry (should be not found)")

    guarded(
        f"/applications/{task10_app_id}", admin_token,
        lambda: call("DELETE", f"/applications/{task10_app_id}", token=admin_token, expect=204,
                     label="delete task-10 application"),
        "delete task-10 application",
    )

# ---------------------------------------------------------------------------
# Task 11: ApplicationHistoryController reads lockdown - Not Started
# ---------------------------------------------------------------------------
section("Task 11: ApplicationHistoryController reads lockdown")

r = call("POST", "/applications", token=applicant_token,
          json={"applicant": {"id": applicant_id}, "loanAmount": 125000,
                "tenureMonths": 12, "declaredIncome": 44000},
          expect=201, label="applicant creates task-11 application")
task11_app = r.json() if r.ok else None

if not task11_app:
    skip("Task 11 checks skipped, could not create the application")
else:
    task11_app_id = task11_app["id"]

    r = call("POST", "/application-history", token=admin_token,
              json={"application": {"id": task11_app_id}, "user": {"id": applicant_id},
                    "action": "NOTE", "details": "task-11 history entry"},
              expect=201, label="admin creates a history entry on task-11 application")
    task11_history_id = r.json().get("id") if r.ok else None

    call("GET", f"/application-history/{task11_history_id}", expect=401,
         label="unauthenticated reads task-11 history entry (should be unauthorized)")
    call("GET", f"/application-history/{task11_history_id}", token=applicant2_token, expect=403,
         label="unrelated applicant2 reads task-11 history entry (should be forbidden)")
    call("GET", f"/application-history/{task11_history_id}", token=processor_token, expect=403,
         label="processor (not yet assigned) reads task-11 history entry (should be forbidden)")
    call("GET", f"/application-history/{task11_history_id}", token=applicant_token, expect=200,
         label="owning applicant reads task-11 history entry")
    call("GET", f"/application-history/{task11_history_id}", token=admin_token, expect=200,
         label="admin reads task-11 history entry")
    call("GET", "/application-history/999999999", token=admin_token, expect=404,
         label="admin reads a nonexistent history entry (should be not found)")

    call("GET", "/application-history", expect=401,
         label="unauthenticated lists history entries (should be unauthorized)")
    r = call("GET", "/application-history", token=applicant2_token, expect=200,
              label="applicant2 lists history entries")
    record(r.ok and not any(h["id"] == task11_history_id for h in page_content(r)),
           "task-11 history entry does not appear in an unrelated applicant's list")
    r = call("GET", "/application-history", token=applicant_token, expect=200,
              label="owning applicant lists history entries")
    record(r.ok and any(h["id"] == task11_history_id for h in page_content(r)),
           "task-11 history entry appears in the owning applicant's list")
    # size=200: admin sees every history entry system-wide, and this shared dev database has
    # accumulated far more than the default page size (20) worth of entries across this repo's
    # testing history - the default page would silently miss a freshly-created entry once total
    # rows crossed that threshold, which is exactly what started happening here (unrelated to
    # whatever feature is being tested at the time).
    r = call("GET", "/application-history", token=admin_token, params={"size": 200}, expect=200,
              label="admin lists history entries")
    record(r.ok and any(h["id"] == task11_history_id for h in page_content(r)),
           "task-11 history entry appears in the admin's list")

    guarded(
        f"/applications/{task11_app_id}", applicant_token,
        lambda: call("PATCH", f"/applications/submit/{task11_app_id}", token=applicant_token, expect=200,
                     label="applicant submits task-11 application"),
        "submit task-11 application",
    )
    guarded(
        f"/applications/{task11_app_id}", admin_token,
        lambda: call("POST", f"/processor/claim/{task11_app_id}", token=processor_token, expect=200,
                     label="processor claims task-11 application"),
        "claim task-11 application (processor)",
    )

    call("GET", f"/application-history/{task11_history_id}", token=processor_token, expect=200,
         label="assigned processor reads task-11 history entry")
    call("GET", f"/application-history/{task11_history_id}", token=processor2_token, expect=403,
         label="unassigned processor2 reads task-11 history entry (should be forbidden)")
    r = call("GET", "/application-history", token=processor_token, expect=200,
              label="assigned processor lists history entries")
    record(r.ok and any(h["id"] == task11_history_id for h in page_content(r)),
           "task-11 history entry appears in the assigned processor's list")
    r = call("GET", "/application-history", token=processor2_token, expect=200,
              label="unassigned processor2 lists history entries")
    record(r.ok and not any(h["id"] == task11_history_id for h in page_content(r)),
           "task-11 history entry does not appear in an unassigned processor's list")

    task11_new_doc_ids = []
    for doc_type in ("PAN_CARD", "SALARY_SLIP", "ADDRESS_PROOF"):
        # application/pdf, not text/plain - featuresTodo.csv task 10's content-type allow-list
        # rejects text/plain now.
        files = {"file": (f"{doc_type.lower()}.pdf", io.BytesIO(b"%PDF-1.4 dummy file contents"), "application/pdf")}
        data = {"documentType": doc_type}
        r = call("POST", f"/applications/{task11_app_id}/documents", token=applicant_token,
                  files=files, data=data, expect=201, label=f"upload {doc_type} for task-11 application")
        if r.ok:
            task11_new_doc_ids.append(r.json()["id"])

    # verifyApplication() now requires every required document to be individually VERIFIED,
    # not just present and not-REJECTED (featuresTodo.csv task 5) - mark them before verifying.
    for doc_id in task11_new_doc_ids:
        guarded(
            f"/documents/{doc_id}", admin_token,
            lambda doc_id=doc_id: call("PATCH", f"/documents/{doc_id}", token=processor_token,
                         json={"verificationStatus": "VERIFIED"}, expect=200,
                         label=f"mark task-11 document {doc_id} VERIFIED"),
            f"mark task-11 document {doc_id} VERIFIED",
        )
    guarded(
        f"/applications/{task11_app_id}", admin_token,
        lambda: call("POST", f"/processor/applications/{task11_app_id}/verify", token=processor_token, expect=200,
                     label="processor verifies task-11 application"),
        "verify task-11 application",
    )
    guarded(
        f"/applications/{task11_app_id}", admin_token,
        lambda: call("POST", f"/underwriter/claim/{task11_app_id}", token=underwriter_token, expect=200,
                     label="underwriter claims task-11 application"),
        "claim task-11 application (underwriter)",
    )

    call("GET", f"/application-history/{task11_history_id}", token=underwriter_token, expect=200,
         label="assigned underwriter reads task-11 history entry")
    call("GET", f"/application-history/{task11_history_id}", token=underwriter2_token, expect=403,
         label="unassigned underwriter2 reads task-11 history entry (should be forbidden)")
    r = call("GET", "/application-history", token=underwriter_token, expect=200,
              label="assigned underwriter lists history entries")
    record(r.ok and any(h["id"] == task11_history_id for h in page_content(r)),
           "task-11 history entry appears in the assigned underwriter's list")
    r = call("GET", "/application-history", token=underwriter2_token, expect=200,
              label="unassigned underwriter2 lists history entries")
    record(r.ok and not any(h["id"] == task11_history_id for h in page_content(r)),
           "task-11 history entry does not appear in an unassigned underwriter's list")

    guarded(
        f"/application-history/{task11_history_id}", admin_token,
        lambda: call("DELETE", f"/application-history/{task11_history_id}", token=admin_token, expect=204,
                     label="delete task-11 history entry"),
        "delete task-11 history entry",
    )
    r = call("GET", f"/applications/{task11_app_id}/documents", token=admin_token, expect=200,
              label="list task-11 application documents for cleanup")
    for doc in (r.json().get("documents", []) if r.ok else []):
        guarded(
            f"/documents/{doc['id']}", admin_token,
            lambda doc_id=doc["id"]: call("DELETE", f"/documents/{doc_id}", token=admin_token, expect=204,
                         label=f"delete task-11 document {doc_id}"),
            f"delete task-11 document {doc['id']}",
        )
    guarded(
        f"/applications/{task11_app_id}", admin_token,
        lambda: call("DELETE", f"/applications/{task11_app_id}", token=admin_token, expect=204,
                     label="delete task-11 application"),
        "delete task-11 application",
    )

# ---------------------------------------------------------------------------
# Task 13: AuthController /me and /change-password explicit @PreAuthorize - Done
# ---------------------------------------------------------------------------
section("Task 13: AuthController explicit @PreAuthorize")

call("GET", "/auth/me", expect=401,
     label="unauthenticated fetches /me (should be unauthorized)")
call("POST", "/auth/change-password", json={"currentPassword": PASSWORD, "newPassword": "Whatever123!"}, expect=401,
     label="unauthenticated changes password (should be unauthorized)")

for role_label, token, email in (
    ("applicant2", applicant2_token, applicant2_email),
    ("processor2", processor2_token, processor2_email),
    ("underwriter2", underwriter2_token, underwriter2_email),
    ("admin", admin_token, admin_email),
):
    r = call("GET", "/auth/me", token=token, expect=200, label=f"{role_label} fetches their own /me")
    record(r.ok and r.json().get("email") == email, f"{role_label}'s /me returns their own email")

call("POST", "/auth/change-password", token=processor2_token,
     json={"currentPassword": "WrongPassword!", "newPassword": "Whatever123!"}, expect=400,
     label="processor2 changes password with wrong current password (should be bad request)")

NEW_PASSWORD = "TempTest13Pass!"
call("POST", "/auth/change-password", token=processor2_token,
     json={"currentPassword": PASSWORD, "newPassword": NEW_PASSWORD}, expect=200,
     label="processor2 changes their own password")
call("POST", "/auth/login", json={"email": processor2_email, "password": PASSWORD}, expect=401,
     label="processor2's old password no longer works (should be unauthorized)")
call("POST", "/auth/login", json={"email": processor2_email, "password": NEW_PASSWORD}, expect=200,
     label="processor2 logs in with their new password")

call("POST", "/auth/change-password", token=processor2_token,
     json={"currentPassword": NEW_PASSWORD, "newPassword": PASSWORD}, expect=200,
     label="processor2 reverts their password back to the shared test password")
call("POST", "/auth/login", json={"email": processor2_email, "password": PASSWORD}, expect=200,
     label="processor2 logs in again with the reverted (shared) password")

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------
section("Cleanup")

if admin_created_doc_id:
    guarded(
        f"/documents/{admin_created_doc_id}", admin_token,
        lambda: call("DELETE", f"/documents/{admin_created_doc_id}", token=admin_token, expect=204,
                     label="delete admin-created document"),
        "delete admin-created document",
    )

guarded(
    f"/applications/{base_app_id}", admin_token,
    lambda: call("DELETE", f"/applications/{base_app_id}", token=admin_token, expect=204,
                 label="delete base application"),
    "delete base application",
)

print(f"\nNote: the test users ({applicant_email}, {processor_email}, "
      f"{underwriter_email}, {admin_email}, {applicant2_email}, {processor2_email}, "
      f"{underwriter2_email}) were left in the database on purpose - the next run will reuse them.")

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
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
