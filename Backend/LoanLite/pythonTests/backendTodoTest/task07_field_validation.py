"""
todo/backendTodo.csv - Task 7: Add field-level validation (loan amount
range, tenure discrete set, required/format checks).

Design under test (see the CSV row and the conversation where the
entity-vs-DTO and partial-update questions were resolved): Jakarta Bean
Validation annotations directly on the LoanApplication/User entities
(no new request DTOs introduced), enforced via @Valid ONLY at endpoints
that always expect a full object:
  - POST /api/applications (create)
  - POST /api/auth/register (via RegisterRequest)
  - POST /api/users (admin-created user)
PUT /api/applications/{id} and PUT /api/users/{id} are intentionally left
without @Valid, since both are partial merges (only non-null fields
overwrite) - @Valid there would incorrectly reject a legitimate partial
update that omits an otherwise-required field. Instead,
LoanApplicationController.update() has explicit manual checks for
loanAmount/tenureMonths/declaredIncome, applied ONLY when that specific
field is present in the request body.

Rules enforced:
  - loanAmount: required, 50000 <= x <= 2500000 (project charter range)
  - tenureMonths: required, must be one of {12, 24, 36, 48, 60} (discrete
    set, not a range - see ValidTenure/TenureValidator)
  - declaredIncome: required, > 0
  - User.email (register / admin-create): required, valid email format
  - User.firstName/lastName (register / admin-create): required
  - RegisterRequest.password: required, >= 8 characters

A @Valid failure returns 400 with the standard JSON error shape, message
built by joining "field: reason" for every failing field
(GlobalExceptionHandler's new MethodArgumentNotValidException handler).
A partial-update violation returns 400 via ApiException.badRequest (same
JSON shape, single-field message).

Until this lands, every "should be rejected" check below is EXPECTED to
FAIL (currently 201/200 instead of 400) - that failure is the whole point
of pre-writing this regression test.

Usage:
    pip install requests
    python task07_field_validation.py

Requires pythonTests/TempTest.py to have been run at least once already
(creates/role-assigns the fixed test accounts) and the Spring Boot app
running on http://localhost:8080.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
from common import (  # noqa: E402
    call, record, section, skip, setup_users, create_application,
    cleanup_application, print_summary, PASSWORD,
)

users = setup_users()

# ---------------------------------------------------------------------------
# create() - loanAmount range
# ---------------------------------------------------------------------------
section("Task 7: create() rejects an out-of-range loanAmount")

r = call("POST", "/applications", token=users.applicant.token,
          json={"applicant": {"id": users.applicant.id}, "loanAmount": 1,
                "tenureMonths": 12, "declaredIncome": 40000},
          expect=400, label="create with loanAmount=1 (below the 50000 minimum)")
if r.status_code == 400:
    record("loanAmount" in (r.json().get("message") or ""), "error message names the loanAmount field")

call("POST", "/applications", token=users.applicant.token,
     json={"applicant": {"id": users.applicant.id}, "loanAmount": 3000000,
           "tenureMonths": 12, "declaredIncome": 40000},
     expect=400, label="create with loanAmount=3000000 (above the 2500000 maximum)")

call("POST", "/applications", token=users.applicant.token,
     json={"applicant": {"id": users.applicant.id}, "tenureMonths": 12, "declaredIncome": 40000},
     expect=400, label="create with loanAmount omitted entirely")

# ---------------------------------------------------------------------------
# create() - tenureMonths discrete set
# ---------------------------------------------------------------------------
section("Task 7: create() rejects a tenureMonths value outside the discrete set")

r = call("POST", "/applications", token=users.applicant.token,
          json={"applicant": {"id": users.applicant.id}, "loanAmount": 200000,
                "tenureMonths": 18, "declaredIncome": 40000},
          expect=400, label="create with tenureMonths=18 (not one of 12/24/36/48/60)")
if r.status_code == 400:
    record("tenureMonths" in (r.json().get("message") or ""), "error message names the tenureMonths field")

call("POST", "/applications", token=users.applicant.token,
     json={"applicant": {"id": users.applicant.id}, "loanAmount": 200000, "declaredIncome": 40000},
     expect=400, label="create with tenureMonths omitted entirely")

# ---------------------------------------------------------------------------
# create() - declaredIncome required
# ---------------------------------------------------------------------------
section("Task 7: create() rejects a missing/non-positive declaredIncome")

call("POST", "/applications", token=users.applicant.token,
     json={"applicant": {"id": users.applicant.id}, "loanAmount": 200000, "tenureMonths": 12},
     expect=400, label="create with declaredIncome omitted entirely")

call("POST", "/applications", token=users.applicant.token,
     json={"applicant": {"id": users.applicant.id}, "loanAmount": 200000, "tenureMonths": 12,
           "declaredIncome": 0},
     expect=400, label="create with declaredIncome=0")

# ---------------------------------------------------------------------------
# create() - a fully valid request still succeeds (sanity/no false positives)
# ---------------------------------------------------------------------------
section("Task 7: create() still accepts a fully valid application")

app = create_application(users.applicant, label="create a valid application (sanity check)")
if app:
    record(float(app.get("loanAmount", 0)) == 200000.0, "valid application was created with the expected loanAmount")
    cleanup_application(app["id"], users.admin)
else:
    skip("Sanity create check skipped")

# ---------------------------------------------------------------------------
# update() - partial merge still enforces the same rules on fields present,
# but does NOT reject a partial body that omits other required fields.
# ---------------------------------------------------------------------------
section("Task 7: update() validates loanAmount/tenureMonths only when present in the partial body")

app2 = create_application(users.applicant, label="create application for update-validation checks")
if not app2:
    skip("update() validation checks skipped, could not create the application")
else:
    app2_id = app2["id"]

    call("PUT", f"/applications/{app2_id}", token=users.applicant.token,
         json={"loanAmount": 10}, expect=400,
         label="update with loanAmount=10 (below minimum) is rejected")
    call("PUT", f"/applications/{app2_id}", token=users.applicant.token,
         json={"tenureMonths": 18}, expect=400,
         label="update with tenureMonths=18 (not in the discrete set) is rejected")
    call("PUT", f"/applications/{app2_id}", token=users.applicant.token,
         json={"declaredIncome": -5}, expect=400,
         label="update with a negative declaredIncome is rejected")

    r = call("PUT", f"/applications/{app2_id}", token=users.applicant.token,
              json={"applicationNumber": app2["applicationNumber"]}, expect=200,
              label="update omitting loanAmount/tenureMonths/declaredIncome entirely still succeeds "
                    "(partial-update semantics preserved)")
    if r.ok:
        record(float(r.json().get("loanAmount", 0)) == 200000.0,
               "loanAmount is unchanged after the partial update that didn't touch it")

    cleanup_application(app2_id, users.admin)

# ---------------------------------------------------------------------------
# AuthController.register() - email format, required fields, password length
# ---------------------------------------------------------------------------
section("Task 7: register() validates email format, required fields, and password length")

call("POST", "/auth/register",
     json={"email": "not-an-email", "password": PASSWORD, "firstName": "Task7", "lastName": "User"},
     expect=400, label="register with a malformed email")

call("POST", "/auth/register",
     json={"email": "task7-shortpw@loanlite.test", "password": "short", "firstName": "Task7", "lastName": "User"},
     expect=400, label="register with a password under 8 characters")

call("POST", "/auth/register",
     json={"email": "task7-noname@loanlite.test", "password": PASSWORD, "lastName": "User"},
     expect=400, label="register with firstName omitted entirely")

# ---------------------------------------------------------------------------
# UserController.create() (admin-only) - same entity constraints apply
# ---------------------------------------------------------------------------
section("Task 7: admin POST /api/users validates email format")

call("POST", "/users", token=users.admin.token,
     json={"email": "not-an-email", "passwordHash": PASSWORD, "firstName": "Task7", "lastName": "Admin",
           "role": "ROLE_USER"},
     expect=400, label="admin creates a user with a malformed email")

print_summary()
