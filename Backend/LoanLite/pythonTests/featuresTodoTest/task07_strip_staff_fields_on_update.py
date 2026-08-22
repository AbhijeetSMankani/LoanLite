"""
todo/featuresTodo.csv - Task 7: Strip staff-only fields on
LoanApplicationController.update for the owning applicant.

Design under test (see the CSV row for full background): create() already
force-nulls recommendation/recommendationReason/decision/decisionComments/
processor/underwriter/creditScore/verifiedIncome regardless of what the
caller sends (see LoanApplicationController.java's create()). update()
never got the same treatment for the accessGuard.isOwningApplicant branch -
today it only nulls status; every other field, including those 8, passes
straight through to LoanApplicationService.updateApplication() untouched.

The fix (not yet implemented): in the isOwningApplicant branch of update(),
force those 8 fields back to whatever `existing` already had, the same way
status is forced today - copying from existing, not nulling. For a freshly
created Draft application `existing` is already null for all 8 (create()
guarantees that), so the observable effect in this test is identical to
nulling: an owning applicant's forged values for these fields should never
persist while still Draft.

Scope check: this stripping is specific to the isOwningApplicant branch
only. Staff (assigned processor/underwriter, admin) update at any status
and are NOT subject to this stripping - their writes to these fields
should still persist, unchanged by this task.

Usage:
    pip install requests
    python task07_strip_staff_fields_on_update.py

Requires pythonTests/TempTest.py to have been run at least once already
(creates/role-assigns the fixed test accounts) and the Spring Boot app
running on http://localhost:8080.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
from common import (  # noqa: E402
    call, record, section, skip, guarded, setup_users, create_application,
    cleanup_application, print_summary,
)

users = setup_users()

STAFF_ONLY_FIELDS = (
    "recommendation", "recommendationReason", "decision", "decisionComments",
    "processor", "underwriter", "creditScore", "verifiedIncome",
)

# ---------------------------------------------------------------------------
# Owning applicant, still Draft: forging all 8 fields at once must not stick,
# but a legitimate field alongside them must still update.
# ---------------------------------------------------------------------------
section("Task 7: owning applicant cannot forge staff-only fields via update while Draft")

app = create_application(users.applicant, label="create application for staff-field-stripping check")
if not app:
    skip("Staff-field-stripping checks skipped, could not create the application")
else:
    app_id = app["id"]

    # Sanity: create() already guarantees these 8 start out null.
    for field in STAFF_ONLY_FIELDS:
        record(app.get(field) is None,
               f"fresh Draft application starts with {field} null (got {app.get(field)!r})")

    forged_body = {
        "loanAmount": 999999,
        "recommendation": "APPROVE",
        "recommendationReason": "forged",
        "decision": "APPROVED",
        "decisionComments": "forged",
        "processor": {"id": users.processor.id},
        "underwriter": {"id": users.underwriter.id},
        "creditScore": 800,
        "verifiedIncome": 999999,
    }
    r = call("PUT", f"/applications/{app_id}", token=users.applicant.token, json=forged_body, expect=200,
             label="owning applicant PUTs an update forging all 8 staff-only fields plus loanAmount")
    updated = r.json() if r.ok else {}

    record(r.ok and float(updated.get("loanAmount", 0)) == 999999.0,
           f"loanAmount (a legitimate field) still updates normally (got {updated.get('loanAmount')!r})")

    for field in STAFF_ONLY_FIELDS:
        record(updated.get(field) is None,
               f"{field} is stripped back to null on the owning-applicant update (got {updated.get(field)!r})")

    # -----------------------------------------------------------------------
    # Scope check: staff updates (not the owning-applicant branch) are NOT
    # subject to this stripping - only confirming this for the two fields
    # most directly tied to the recommendation-forgery risk in the CSV.
    # -----------------------------------------------------------------------
    section("Task 7: staff updates are unaffected - stripping is owning-applicant-only")

    guarded(
        f"/applications/{app_id}", users.applicant.token,
        lambda: call("PATCH", f"/applications/submit/{app_id}", token=users.applicant.token, expect=200,
                     label="applicant submits the application"),
        "submit application for staff-update scope check",
    )
    guarded(
        f"/applications/{app_id}", users.admin.token,
        lambda: call("POST", f"/processor/claim/{app_id}", token=users.processor.token, expect=200,
                     label="processor claims the application"),
        "processor claims the application for staff-update scope check",
    )

    def staff_update_check():
        r = call("PUT", f"/applications/{app_id}", token=users.processor.token,
                 json={"creditScore": 800, "verifiedIncome": 999999}, expect=200,
                 label="assigned processor updates creditScore/verifiedIncome after claim")
        body = r.json() if r.ok else {}
        record(r.ok and body.get("creditScore") == 800,
               f"assigned processor's creditScore update persists, not stripped (got {body.get('creditScore')!r})")
        record(r.ok and float(body.get("verifiedIncome", 0)) == 999999.0,
               f"assigned processor's verifiedIncome update persists, not stripped (got {body.get('verifiedIncome')!r})")

    guarded(f"/applications/{app_id}", users.processor.token, staff_update_check,
            "assigned processor updates creditScore/verifiedIncome (scope check)")

    cleanup_application(app_id, users.admin)

# ---------------------------------------------------------------------------
# Regression guards, unrelated to this task but cheap to confirm here too.
# ---------------------------------------------------------------------------
section("Task 7: unchanged regressions - ownership and auth on update")

neg_app = create_application(users.applicant, label="create application for update regression checks")
if not neg_app:
    skip("Update regression checks skipped, could not create the application")
else:
    neg_app_id = neg_app["id"]

    call("PUT", f"/applications/{neg_app_id}", json={"loanAmount": 1234}, expect=401,
         label="unauthenticated updates the application (should be unauthorized)")
    call("PUT", f"/applications/{neg_app_id}", token=users.applicant2.token,
         json={"creditScore": 800, "loanAmount": 1234}, expect=403,
         label="unrelated applicant2 forges an update on someone else's application (should be forbidden)")

    cleanup_application(neg_app_id, users.admin)

print_summary()
