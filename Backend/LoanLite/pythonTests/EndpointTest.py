"""
End-to-end smoke test for the LoanLite backend.

Exercises every controller endpoint (Auth, Users, LoanApplications, Processor,
Documents, ApplicationHistory) using four real accounts, one per role, wired
together with the ids/tokens each call returns.

Usage:
    pip install requests
    python EndpointTest.py

The Spring Boot app must already be running on http://localhost:8080.

Role assignment is not exposed through any API yet, so the script pauses
after registering the four accounts and asks you to set their roles
directly in the database, then continues.
"""

import io
import sys
import uuid

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


# ---------------------------------------------------------------------------
# Section 1: register the four role accounts
# ---------------------------------------------------------------------------
section("1. Register test users (one per role)")

run_id = uuid.uuid4().hex[:8]
applicant_email = f"applicant.{run_id}@loanlite.test"
processor_email = f"processor.{run_id}@loanlite.test"
underwriter_email = f"underwriter.{run_id}@loanlite.test"
admin_email = f"admin.{run_id}@loanlite.test"

applicant_user = register(applicant_email, "Alice", "Applicant")
processor_user = register(processor_email, "Pat", "Processor")
underwriter_user = register(underwriter_email, "Uma", "Underwriter")
admin_user = register(admin_email, "Adam", "Admin")

if not all([applicant_user, processor_user, underwriter_user, admin_user]):
    print("\n[ABORT] One or more registrations failed, cannot continue.")
    sys.exit(1)

applicant_id = applicant_user["id"]
processor_id = processor_user["id"]
underwriter_id = underwriter_user["id"]
admin_id = admin_user["id"]

print(f"\n  applicant_id={applicant_id}  processor_id={processor_id}  "
      f"underwriter_id={underwriter_id}  admin_id={admin_id}")

# ---------------------------------------------------------------------------
# Section 2: pause for manual role assignment
# ---------------------------------------------------------------------------
section("2. Manual role assignment required")

print("""
Role assignment isn't exposed through the API yet. Run these against the
database directly (roles must keep the ROLE_ prefix - that's what
CustomUserDetailsService hands to Spring Security):
""")
print(f"  UPDATE users SET role = 'ROLE_ADMIN'       WHERE email = '{admin_email}';")
print(f"  UPDATE users SET role = 'ROLE_PROCESSOR'    WHERE email = '{processor_email}';")
print(f"  UPDATE users SET role = 'ROLE_UNDERWRITER'  WHERE email = '{underwriter_email}';")
print(f"  -- {applicant_email} stays ROLE_USER, no change needed\n")

input("Press Enter once the roles above are set in the database...")

# ---------------------------------------------------------------------------
# Section 3: log in and confirm each role took effect
# ---------------------------------------------------------------------------
section("3. Log in and verify roles via /auth/me")

applicant_token = login(applicant_email)
processor_token = login(processor_email)
underwriter_token = login(underwriter_email)
admin_token = login(admin_email)


def check_role(token, label, expected_fragment):
    if not token:
        return record(False, f"{label}: no token, cannot check role")
    r = call("GET", "/auth/me", token=token, expect=200, label=f"GET /auth/me ({label})")
    role = r.json().get("role", "") if r.ok else ""
    return record(expected_fragment in role, f"{label} role is '{role}' (expected to contain '{expected_fragment}')")


check_role(applicant_token, "applicant", "USER")
check_role(processor_token, "processor", "PROCESSOR")
check_role(underwriter_token, "underwriter", "UNDERWRITER")
check_role(admin_token, "admin", "ADMIN")

# ---------------------------------------------------------------------------
# Section 4: /api/users
# ---------------------------------------------------------------------------
section("4. User endpoints")

call("GET", f"/users/{applicant_id}", token=applicant_token, expect=200,
     label="applicant reads own user record")
call("GET", f"/users/{processor_id}", token=applicant_token, expect=403,
     label="applicant reads someone else's user record (should be forbidden)")
call("GET", "/users", token=applicant_token, expect=403,
     label="applicant lists all users (should be forbidden, not ADMIN)")
call("GET", "/users", token=admin_token, expect=200, label="admin lists all users")
call("GET", f"/users/{applicant_id}", token=admin_token, expect=200,
     label="admin reads applicant's user record")

guarded(
    f"/users/{applicant_id}", applicant_token,
    lambda: call("PUT", f"/users/{applicant_id}", token=applicant_token,
                 json={"phone": "555-0100"}, expect=200, label="applicant updates own phone"),
    "update applicant phone",
)
r = call("GET", f"/users/{applicant_id}", token=applicant_token, expect=200,
         label="re-read applicant after phone update")
record(r.ok and r.json().get("phone") == "555-0100", "phone update actually persisted")

call("POST", "/users", token=applicant_token,
     json={"email": f"blocked.{run_id}@loanlite.test", "passwordHash": PASSWORD},
     expect=403, label="non-admin creates a user via POST /users (should be forbidden)")

temp_user_email = f"tempuser.{run_id}@loanlite.test"
r = call("POST", "/users", token=admin_token,
          json={"email": temp_user_email, "passwordHash": PASSWORD,
                "firstName": "Temp", "lastName": "User", "role": "ROLE_USER"},
          expect=201, label="admin creates a disposable user")
temp_user_id = r.json().get("id") if r.ok else None

# deliberate not-found probe, to see how the API behaves for a missing id
r = requests.get(f"{BASE}/users/999999999", headers=auth(admin_token), timeout=TIMEOUT)
if not record(r.status_code == 404, f"GET /users/999999999 -> expected 404, got {r.status_code}"):
    print(f"         body: {response_snippet(r)}")

if temp_user_id:
    guarded(
        f"/users/{temp_user_id}", admin_token,
        lambda: call("DELETE", f"/users/{temp_user_id}", token=admin_token, expect=204,
                     label="admin deletes disposable user"),
        "delete disposable user",
    )
    r = requests.get(f"{BASE}/users/{temp_user_id}", headers=auth(admin_token), timeout=TIMEOUT)
    record(r.status_code != 200, "disposable user no longer retrievable after delete")

# ---------------------------------------------------------------------------
# Section 5: application #1 - the "clean" happy path all the way to underwriter
# ---------------------------------------------------------------------------
section("5. LoanApplication #1: create, fill in, submit")

r = call("POST", "/applications", token=applicant_token,
          json={"applicant": {"id": applicant_id}, "loanAmount": 500000,
                "tenureMonths": 36, "declaredIncome": 60000},
          expect=201, label="applicant creates application #1")
app1 = r.json() if r.ok else None
if not app1:
    print("\n[ABORT] Could not create application #1, cannot continue with dependent sections.")
    sys.exit(1)
app1_id = app1["id"]
app1_number = app1["applicationNumber"]
record(app1.get("status") == "Draft", "application #1 starts in Draft status")

call("GET", f"/applications/{app1_id}", token=applicant_token, expect=200,
     label="GET application #1 by id")
call("GET", f"/applications/application-number/{app1_number}", token=applicant_token,
     expect=200, label="GET application #1 by application number")

guarded(
    f"/applications/{app1_id}", applicant_token,
    lambda: call("PUT", f"/applications/{app1_id}", token=applicant_token,
                 json={"loanAmount": 550000, "creditScore": 750, "verifiedIncome": 50000},
                 expect=200, label="update application #1 (loan amount, credit score, verified income)"),
    "update application #1",
)

app1_doc_ids = []
for doc_type in ("PAN_CARD", "SALARY_SLIP", "AADHAAR_CARD"):
    files = {"file": (f"{doc_type.lower()}.txt", io.BytesIO(b"dummy file contents"), "text/plain")}
    data = {"documentType": doc_type, "remarks": f"test upload for {doc_type}"}
    r = call("POST", f"/applications/{app1_id}/documents", token=applicant_token,
              files=files, data=data, expect=201, label=f"upload {doc_type} for application #1")
    if r.ok:
        app1_doc_ids.append(r.json()["id"])

r = call("GET", f"/applications/{app1_id}/documents", token=applicant_token, expect=200,
          label="list documents + missing-required check for application #1")
if r.ok:
    record(r.json().get("missingRequiredDocuments") == [], "no required documents missing after all 3 uploads")

guarded(
    f"/applications/{app1_id}", applicant_token,
    lambda: call("PATCH", f"/applications/submit/{app1_id}", token=applicant_token, expect=200,
                 label="applicant submits application #1"),
    "submit application #1",
)
r = call("GET", f"/applications/{app1_id}", token=applicant_token, expect=200,
          label="re-read application #1 after submit")
record(r.ok and r.json().get("status") == "Submitted", "application #1 status is Submitted")

# ---------------------------------------------------------------------------
# Section 6: processor claims, verifies documents, verifies application #1
# ---------------------------------------------------------------------------
section("6. Processor flow on application #1")

call("GET", "/processor/work-list", token=applicant_token, expect=403,
     label="applicant reads processor work-list (should be forbidden)")
r = call("GET", "/processor/work-list", token=processor_token, expect=200,
          label="processor reads work-list")
if r.ok:
    record(any(a["id"] == app1_id for a in r.json()), "application #1 appears in the work-list")

guarded(
    f"/applications/{app1_id}", processor_token,
    lambda: call("POST", f"/processor/claim/{app1_id}", token=processor_token, expect=200,
                 label="processor claims application #1"),
    "claim application #1",
)
r = call("GET", f"/applications/{app1_id}", token=processor_token, expect=200,
          label="re-read application #1 after claim")
if r.ok:
    body = r.json()
    record(body.get("status") == "In Review", "application #1 status is In Review after claim")
    record((body.get("processor") or {}).get("id") == processor_id, "processor is assigned on application #1")

for doc_id in app1_doc_ids:
    guarded(
        f"/documents/{doc_id}", processor_token,
        lambda doc_id=doc_id: call("PATCH", f"/documents/{doc_id}", token=processor_token,
                     json={"verificationStatus": "VERIFIED"}, expect=200,
                     label=f"processor verifies document {doc_id}"),
        f"verify document {doc_id}",
    )

call("POST", f"/processor/applications/{app1_id}/verify", token=applicant_token, expect=403,
     label="applicant runs processor verify on application #1 (should be forbidden)")

guarded(
    f"/applications/{app1_id}", processor_token,
    lambda: call("POST", f"/processor/applications/{app1_id}/verify", token=processor_token, expect=200,
                 label="processor verifies application #1"),
    "verify application #1",
)
r = call("GET", f"/applications/{app1_id}", token=processor_token, expect=200,
          label="re-read application #1 after verify")
if r.ok:
    body = r.json()
    record(body.get("recommendation") == "APPROVE",
           f"recommendation is APPROVE (got {body.get('recommendation')})")
    record(body.get("status") == "Ready for Underwriter",
           f"status is Ready for Underwriter (got {body.get('status')})")

# ---------------------------------------------------------------------------
# Section 7: underwriter assignment + combined query-param filtering
# ---------------------------------------------------------------------------
section("7. Underwriter assignment and combined /applications filters")

guarded(
    f"/applications/{app1_id}", admin_token,
    lambda: call("PUT", f"/applications/{app1_id}", token=admin_token,
                 json={"underwriter": {"id": underwriter_id}}, expect=200,
                 label="assign underwriter to application #1"),
    "assign underwriter",
)

r = call("GET", "/applications", token=applicant_token,
          params={"status": "Ready for Underwriter"}, expect=200,
          label="filter applications by status only")
record(r.ok and any(a["id"] == app1_id for a in r.json()), "status filter finds application #1")

r = call("GET", "/applications", token=applicant_token,
          params={"underwriterId": underwriter_id}, expect=200,
          label="filter applications by underwriterId only")
record(r.ok and any(a["id"] == app1_id for a in r.json()), "underwriterId filter finds application #1")

r = call("GET", "/applications", token=applicant_token,
          params={"underwriterId": underwriter_id, "status": "Ready for Underwriter"}, expect=200,
          label="combined filter: matching underwriterId AND matching status")
record(r.ok and any(a["id"] == app1_id for a in r.json()),
       "combined filter (matching both) finds application #1")

r = call("GET", "/applications", token=applicant_token,
          params={"underwriterId": underwriter_id, "status": "Draft"}, expect=200,
          label="combined filter: matching underwriterId but non-matching status")
record(r.ok and not any(a["id"] == app1_id for a in r.json()),
       "combined filter (status doesn't match) correctly excludes application #1 - "
       "confirms filters actually AND together instead of the first non-null param winning")

# ---------------------------------------------------------------------------
# Section 8: application #2 - missing documents, request-documents, withdraw
# ---------------------------------------------------------------------------
section("8. LoanApplication #2: missing docs, request-documents, withdraw")

r = call("POST", "/applications", token=applicant_token,
          json={"applicant": {"id": applicant_id}, "loanAmount": 100000,
                "tenureMonths": 12, "declaredIncome": 40000},
          expect=201, label="applicant creates application #2 (no documents)")
app2 = r.json() if r.ok else None
if not app2:
    print("\n[ABORT] Could not create application #2, skipping section 8.")
else:
    app2_id = app2["id"]
    guarded(
        f"/applications/{app2_id}", applicant_token,
        lambda: call("PATCH", f"/applications/submit/{app2_id}", token=applicant_token, expect=200,
                     label="applicant submits application #2"),
        "submit application #2",
    )
    guarded(
        f"/applications/{app2_id}", processor_token,
        lambda: call("POST", f"/processor/claim/{app2_id}", token=processor_token, expect=200,
                     label="processor claims application #2"),
        "claim application #2",
    )

    call("PATCH", f"/documents/applications/{app2_id}/request-documents", token=applicant_token,
         json={"message": "please upload your PAN card"}, expect=403,
         label="applicant calls request-documents (should be forbidden, PROCESSOR only)")

    guarded(
        f"/applications/{app2_id}", processor_token,
        lambda: call("PATCH", f"/documents/applications/{app2_id}/request-documents", token=processor_token,
                     json={"message": "please upload your PAN card"}, expect=200,
                     label="processor requests missing documents on application #2"),
        "request documents on application #2",
    )
    r = call("GET", f"/applications/{app2_id}", token=processor_token, expect=200,
              label="re-read application #2 after request-documents")
    if r.ok:
        body = r.json()
        record(body.get("status") == "Waiting for Documents",
               f"status is Waiting for Documents (got {body.get('status')})")
        record(body.get("decisionComments") == "please upload your PAN card",
               "decisionComments carries the request-documents message")

    guarded(
        f"/applications/{app2_id}", applicant_token,
        lambda: call("PATCH", f"/applications/withdraw/{app2_id}", token=applicant_token, expect=200,
                     label="applicant withdraws application #2"),
        "withdraw application #2",
    )
    r = call("GET", f"/applications/{app2_id}", token=applicant_token, expect=200,
              label="re-read application #2 after withdraw")
    record(r.ok and r.json().get("status") == "Withdrawn", "application #2 status is Withdrawn")

# ---------------------------------------------------------------------------
# Section 9: DocumentController's direct JSON create/update/delete path
# ---------------------------------------------------------------------------
section("9. Document metadata-only create/update/delete (not the multipart path)")

temp_doc_id = None
if app2:
    r = call("POST", "/documents", token=applicant_token,
              json={"application": {"id": app2_id}, "documentType": "OTHER",
                    "verificationStatus": "PENDING"},
              expect=201, label="create document record directly via JSON (no file)")
    temp_doc_id = r.json().get("id") if r.ok else None

    call("GET", f"/documents/{temp_doc_id}", token=applicant_token, expect=200,
         label="GET the JSON-created document")
    r = call("GET", "/documents", token=applicant_token, expect=200, label="list all documents")
    record(r.ok and any(d["id"] == temp_doc_id for d in r.json()), "JSON-created document appears in the list")

    guarded(
        f"/documents/{temp_doc_id}", applicant_token,
        lambda: call("PUT", f"/documents/{temp_doc_id}", token=applicant_token,
                     json={"remarks": "updated remarks"}, expect=200,
                     label="update the JSON-created document"),
        "update JSON-created document",
    )
    guarded(
        f"/documents/{temp_doc_id}", applicant_token,
        lambda: call("DELETE", f"/documents/{temp_doc_id}", token=applicant_token, expect=204,
                     label="delete the JSON-created document"),
        "delete JSON-created document",
    )
    r = requests.get(f"{BASE}/documents/{temp_doc_id}", headers=auth(applicant_token), timeout=TIMEOUT)
    record(r.status_code != 200, "JSON-created document no longer retrievable after delete")
else:
    skip("section 9 skipped, application #2 was not created")

# ---------------------------------------------------------------------------
# Section 10: ApplicationHistory CRUD
# ---------------------------------------------------------------------------
section("10. ApplicationHistory CRUD")

r = call("POST", "/application-history", token=processor_token,
          json={"application": {"id": app1_id}, "user": {"id": processor_id},
                "action": "CLAIMED", "details": "claimed for review"},
          expect=201, label="create application-history entry")
history_id = r.json().get("id") if r.ok else None

if history_id:
    call("GET", f"/application-history/{history_id}", token=processor_token, expect=200,
         label="GET the history entry")
    r = call("GET", "/application-history", token=processor_token, expect=200,
              label="list all history entries")
    record(r.ok and any(h["id"] == history_id for h in r.json()), "history entry appears in the list")

    guarded(
        f"/application-history/{history_id}", processor_token,
        lambda: call("PUT", f"/application-history/{history_id}", token=processor_token,
                     json={"details": "claimed for review - updated"}, expect=200,
                     label="update the history entry"),
        "update history entry",
    )
    guarded(
        f"/application-history/{history_id}", processor_token,
        lambda: call("DELETE", f"/application-history/{history_id}", token=processor_token, expect=204,
                     label="delete the history entry"),
        "delete history entry",
    )
    r = requests.get(f"{BASE}/application-history/{history_id}", headers=auth(processor_token), timeout=TIMEOUT)
    record(r.status_code != 200, "history entry no longer retrievable after delete")

# ---------------------------------------------------------------------------
# Section 11: auth extras (/me already covered, change-password, logout)
# ---------------------------------------------------------------------------
section("11. Auth: change-password and logout")

call("POST", "/auth/change-password", token=applicant_token,
     json={"currentPassword": "wrong-password", "newPassword": "NewPass123!"},
     expect=400, label="change-password with wrong current password (should fail)")

r = call("POST", "/auth/change-password", token=applicant_token,
          json={"currentPassword": PASSWORD, "newPassword": "NewPass123!"},
          expect=200, label="change-password with correct current password")
if r.ok:
    # login() reuses the module-level PASSWORD (now stale for this user), so verify manually instead
    r2 = requests.post(f"{BASE}/auth/login", json={"email": applicant_email, "password": "NewPass123!"},
                        timeout=TIMEOUT)
    record(r2.status_code == 200, "can log in with the new password after change-password")
    if r2.ok:
        applicant_token = r2.json()["token"]

call("POST", "/auth/logout", expect=200, label="logout (no-op endpoint)")

r = requests.get(f"{BASE}/auth/me", headers={"Authorization": "Bearer not-a-real-token"}, timeout=TIMEOUT)
if not record(r.status_code == 401, f"GET /auth/me with a garbage token -> expected 401, got {r.status_code}"):
    print(f"         body: {response_snippet(r)}")

# ---------------------------------------------------------------------------
# Section 12: cleanup - delete application #1's documents and both applications
# ---------------------------------------------------------------------------
section("12. Cleanup: delete application #1's documents, then both applications")

for doc_id in app1_doc_ids:
    guarded(
        f"/documents/{doc_id}", processor_token,
        lambda doc_id=doc_id: call("DELETE", f"/documents/{doc_id}", token=processor_token, expect=204,
                     label=f"delete application #1 document {doc_id}"),
        f"delete document {doc_id}",
    )

guarded(
    f"/applications/{app1_id}", admin_token,
    lambda: call("DELETE", f"/applications/{app1_id}", token=admin_token, expect=204,
                 label="delete application #1"),
    "delete application #1",
)
if app2:
    guarded(
        f"/applications/{app2_id}", admin_token,
        lambda: call("DELETE", f"/applications/{app2_id}", token=admin_token, expect=204,
                     label="delete application #2"),
        "delete application #2",
    )

print(f"\nNote: the four test users ({applicant_email}, {processor_email}, "
      f"{underwriter_email}, {admin_email}) were left in the database. "
      "Delete them manually if you don't want them hanging around.")

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
