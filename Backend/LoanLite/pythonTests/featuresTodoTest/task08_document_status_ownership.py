"""
todo/featuresTodo.csv - Task 8: Restore the ownership check in
DocumentController.updateDocumentStatus.

Design under test (see the CSV row for full background): PATCH
/api/documents/{documentId} - the endpoint a processor uses to mark one
uploaded document Verified or Rejected - is guarded only by
@PreAuthorize("hasRole('PROCESSOR')") today. There is NO check that the
caller is the processor actually assigned to that document's application,
so as written today ANY user with the PROCESSOR role can flip ANY
document's verificationStatus for ANY application system-wide. The method
body even has a commented-out sketch of the intended check, but it's not
quite correct as written (applicationId isn't a parameter of that method).

This task adds a real ownership check using
LoanApplicationAccessGuard.isAssignedProcessor(doc.getApplication(), caller),
returning 403 when the caller is not the assigned processor. This does NOT
change the role gate itself - @PreAuthorize("hasRole('PROCESSOR')") still
runs first, so non-PROCESSOR roles (including admin) keep getting a plain
403 with no ownership-based override; the CSV does not mention one.

Until this lands, the "unassigned processor2" check below is EXPECTED to
FAIL (today it gets 200, this file asserts the desired post-fix 403) - that
failure is the whole point of pre-writing this regression test.

Usage:
    pip install requests
    python task08_document_status_ownership.py

Requires pythonTests/TempTest.py to have been run at least once already
(creates/role-assigns the fixed test accounts) and the Spring Boot app
running on http://localhost:8080.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
from common import (  # noqa: E402
    call, record, section, skip, guarded, setup_users, create_application,
    upload_document, cleanup_application, print_summary,
)

users = setup_users()

# ---------------------------------------------------------------------------
# Setup: applicant creates+submits an application, uploads a document, the
# PROCESSOR (not processor2) claims it.
# ---------------------------------------------------------------------------
section("Task 8: setup - applicant submits, uploads a document, processor claims")

app = create_application(users.applicant, label="create application for document-ownership check")
if not app:
    skip("Task 8 checks skipped, could not create the application")
else:
    app_id = app["id"]
    doc_ids = []

    r = upload_document(app_id, users.applicant.token, "PAN_CARD",
                         label="upload PAN_CARD for document-ownership check")
    doc_id = r.json()["id"] if r.ok else None
    if doc_id:
        doc_ids.append(doc_id)

    guarded(
        f"/applications/{app_id}", users.applicant.token,
        lambda: call("PATCH", f"/applications/submit/{app_id}", token=users.applicant.token, expect=200,
                     label="applicant submits application for document-ownership check"),
        "submit application for document-ownership check",
    )
    guarded(
        f"/applications/{app_id}", users.admin.token,
        lambda: call("POST", f"/processor/claim/{app_id}", token=users.processor.token, expect=200,
                     label="processor claims the application"),
        "processor claims the application",
    )

    if not doc_id:
        skip("Task 8 ownership checks skipped, document upload failed")
    else:
        # ---------------------------------------------------------------
        # Negative checks first, so they exercise the ORIGINAL PENDING
        # status rather than depending on the positive check's mutation
        # having already happened.
        # ---------------------------------------------------------------
        section("Task 8: unauthenticated / wrong-role callers are still rejected")

        call("PATCH", f"/documents/{doc_id}", json={"verificationStatus": "VERIFIED"}, expect=401,
             label="unauthenticated PATCHes the document status (should be unauthorized)")

        for role_label, user in (("applicant", users.applicant), ("underwriter", users.underwriter),
                                  ("admin", users.admin)):
            call("PATCH", f"/documents/{doc_id}", token=user.token,
                 json={"verificationStatus": "VERIFIED"}, expect=403,
                 label=f"{role_label} PATCHes the document status "
                       f"(should still be forbidden, no ownership override)")

        section("Task 8: an unassigned processor cannot update someone else's document")

        call("PATCH", f"/documents/{doc_id}", token=users.processor2.token,
             json={"verificationStatus": "VERIFIED"}, expect=403,
             label="unassigned processor2 PATCHes the document status (should be forbidden - the fix under test)")

        call("PATCH", "/documents/999999999", token=users.processor.token,
             json={"verificationStatus": "VERIFIED"}, expect=404,
             label="assigned processor PATCHes a nonexistent document (should be not found)")

        # ---------------------------------------------------------------
        # Positive check last: the legitimate assigned-processor path must
        # keep working after the ownership check is added.
        # ---------------------------------------------------------------
        section("Task 8: the assigned processor can update the document's status")

        r = call("PATCH", f"/documents/{doc_id}", token=users.processor.token,
                  json={"verificationStatus": "VERIFIED"}, expect=200,
                  label="assigned processor PATCHes the document status to VERIFIED")
        if r.ok:
            record(r.json().get("verificationStatus") == "VERIFIED",
                   f"response reflects the new verificationStatus (got {r.json().get('verificationStatus')!r})")

    cleanup_application(app_id, users.admin, doc_ids=doc_ids)

print_summary()
