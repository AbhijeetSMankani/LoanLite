"""
todo/backendTodo.csv - Task 4: Add an underwriter action to send an
application back to the processor.

Design under test (see the CSV row for full background, and the
conversation where the design questions were resolved): before this task,
once an application reached Under Review, UnderwriterController only
exposed two terminal outcomes (ACCEPTED/REJECTED via decideApplication()).
There was no way for an underwriter who spots a fixable problem (not an
outright reason to reject the applicant) to route the application back to
the processor.

Decisions made when this was scoped:
  - New dedicated endpoint: POST /api/underwriter/applications/{id}/return-to-processor
    (not folded into decideApplication() as a third decision value).
  - Status goes back to "Under Verification" (reused, not a new dedicated
    status like "Returned for Correction").
  - Processor assignment is left untouched - the SAME processor who
    verified it gets it back.
  - The comment is OPTIONAL (mirrors decideApplication()'s decisionComments,
    which is also optional for ACCEPTED/REJECTED).
  - Same ownership+status-precondition pattern as decideApplication():
    assigned-underwriter-only (ApiException.forbidden, checked first),
    application must currently be Under Review (IllegalArgumentException,
    checked second) - same order as every other ownership+state check in
    this codebase.
  - Logs a new "UNDERWRITER_RETURNED" ApplicationHistory action.

Until this lands, every check below is EXPECTED to FAIL (404 - the
endpoint doesn't exist yet) - that failure is the whole point of
pre-writing this regression test.

Usage:
    pip install requests
    python task04_underwriter_return_to_processor.py

Requires pythonTests/TempTest.py to have been run at least once already
(creates/role-assigns the fixed test accounts) and the Spring Boot app
running on http://localhost:8080.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
from common import (  # noqa: E402
    call, record, section, skip, guarded, setup_users, create_application,
    upload_all_required_documents, history_for_application, cleanup_application,
    print_summary,
)

users = setup_users()

# ---------------------------------------------------------------------------
# Setup: applicant creates+submits, uploads+verifies all required documents,
# processor claims+verifies (-> Verified), underwriter claims (-> Under Review).
# ---------------------------------------------------------------------------
section("Task 4: setup - drive an application to Under Review")

app = create_application(users.applicant, label="create application for return-to-processor check")
if not app:
    skip("Task 4 checks skipped, could not create the application")
else:
    app_id = app["id"]
    doc_ids = upload_all_required_documents(app_id, users.applicant.token)

    guarded(
        f"/applications/{app_id}", users.applicant.token,
        lambda: call("PATCH", f"/applications/submit/{app_id}", token=users.applicant.token, expect=200,
                     label="applicant submits application for return-to-processor check"),
        "submit application for return-to-processor check",
    )
    guarded(
        f"/applications/{app_id}", users.admin.token,
        lambda: call("POST", f"/processor/claim/{app_id}", token=users.processor.token, expect=200,
                     label="processor claims the application"),
        "processor claims the application",
    )
    for doc_id in doc_ids:
        guarded(
            f"/documents/{doc_id}", users.processor.token,
            lambda doc_id=doc_id: call("PATCH", f"/documents/{doc_id}", token=users.processor.token,
                                         json={"verificationStatus": "VERIFIED"}, expect=200,
                                         label=f"processor verifies document {doc_id}"),
            f"verify document {doc_id}",
        )
    guarded(
        f"/applications/{app_id}", users.admin.token,
        lambda: call("POST", f"/processor/applications/{app_id}/verify", token=users.processor.token, expect=200,
                     label="processor verifies the application (-> Verified)"),
        "processor verifies the application",
    )
    guarded(
        f"/applications/{app_id}", users.admin.token,
        lambda: call("POST", f"/underwriter/claim/{app_id}", token=users.underwriter.token, expect=200,
                     label="underwriter claims the application (-> Under Review)"),
        "underwriter claims the application",
    )

    # -----------------------------------------------------------------
    # Negative checks first, exercising the ORIGINAL Under Review status.
    # -----------------------------------------------------------------
    section("Task 4: unauthenticated / wrong-role / unassigned callers are rejected")

    call("POST", f"/underwriter/applications/{app_id}/return-to-processor", expect=401,
         label="unauthenticated returns the application to the processor (should be unauthorized)")

    for role_label, user in (("applicant", users.applicant), ("processor", users.processor), ("admin", users.admin)):
        call("POST", f"/underwriter/applications/{app_id}/return-to-processor", token=user.token,
             expect=403, label=f"{role_label} returns the application to the processor (should be forbidden)")

    call("POST", f"/underwriter/applications/{app_id}/return-to-processor", token=users.underwriter2.token,
         expect=403,
         label="unassigned underwriter2 returns the application to the processor (should be forbidden)")

    call("POST", "/underwriter/applications/999999999/return-to-processor", token=users.underwriter.token,
         expect=404, label="assigned-looking underwriter returns a nonexistent application (should be not found)")

    # -----------------------------------------------------------------
    # Positive check: the assigned underwriter can return it, with a comment.
    # -----------------------------------------------------------------
    section("Task 4: the assigned underwriter can return the application to the processor")

    r = call("POST", f"/underwriter/applications/{app_id}/return-to-processor", token=users.underwriter.token,
              json={"comments": "Salary slip figures don't reconcile with declared income, please recheck."},
              expect=200, label="assigned underwriter returns the application to the processor")
    if r.ok:
        updated = r.json()
        record(updated.get("status") == "Under Verification",
               f"status is 'Under Verification' after the return (got {updated.get('status')!r})")
        record(updated.get("processor", {}).get("id") == users.processor.id,
               "the original processor is still assigned (assignment was not cleared)")
        record(updated.get("decisionComments") == "Salary slip figures don't reconcile with declared income, please recheck.",
               f"decisionComments carries the underwriter's reason (got {updated.get('decisionComments')!r})")

        entries = history_for_application(app_id, users.admin.token)
        returned_entries = [h for h in entries if h.get("action") == "UNDERWRITER_RETURNED"]
        record(len(returned_entries) == 1,
               f"exactly one UNDERWRITER_RETURNED history entry was logged (found {len(returned_entries)})")

        # -------------------------------------------------------------
        # Sanity: it's no longer Under Review, so a second return attempt
        # (or a decision attempt) must fail the status precondition.
        # -------------------------------------------------------------
        section("Task 4: cannot return again (or decide) once it has left Under Review")

        call("POST", f"/underwriter/applications/{app_id}/return-to-processor", token=users.underwriter.token,
             expect=400, label="assigned underwriter tries to return it again (should fail, no longer Under Review)")
        call("POST", f"/underwriter/applications/{app_id}/decision", token=users.underwriter.token,
             json={"decision": "ACCEPTED"}, expect=400,
             label="assigned underwriter tries to decide it (should fail, no longer Under Review)")

        # -------------------------------------------------------------
        # Sanity: the processor can pick up where they left off - claim
        # is a no-op here since they're already assigned, but verify()
        # should work again now that it's back in Under Verification.
        # -------------------------------------------------------------
        section("Task 4: the processor can re-verify after the return")

        r = call("POST", f"/processor/applications/{app_id}/verify", token=users.processor.token, expect=200,
                  label="processor re-verifies the application after the return")
        if r.ok:
            record(r.json().get("status") == "Verified",
                   f"status is 'Verified' again after re-verification (got {r.json().get('status')!r})")

    cleanup_application(app_id, users.admin, doc_ids=doc_ids)

print_summary()
