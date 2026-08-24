"""
todo/backendTodo.csv - Task 8: Add a "Waiting for Documents" status,
triggered only by the processor's request-documents action.

Design under test (see the CSV row and the conversation where the two
open questions were resolved):
  - DocumentController.requestDocuments() now sets status to
    "Waiting for Documents" (previously left status untouched entirely).
  - This is option (b), confirmed by the user: PURELY a cosmetic status
    string for the applicant-facing frontend to branch on. No access,
    query, or work-list rule is conditioned on it - it behaves exactly
    like "Under Verification" everywhere else (GET /api/applications
    scoping, the assigned processor keeps ownership, etc).
  - LoanApplicationController.uploadDocument() auto-reverts status back
    to "Under Verification" once every required document type
    (PAN_CARD/SALARY_SLIP/ADDRESS_PROOF) has at least one document that
    isn't REJECTED (PENDING "unverified" or VERIFIED "accepted" both
    count) - confirmed by the user as the revert condition.
  - Logs a new "DOCUMENTS_RESUBMITTED" history entry on that auto-revert.

This is NOT the old featuresTodo_DONE.csv task-5-removed "Waiting for
Documents" status (that one fired from verifyApplication() finding a
missing document) - verifyApplication()'s behavior is completely
unchanged by this task (still 400, no status change, on failure).

Until this lands, every "Waiting for Documents" assertion below is
EXPECTED to FAIL (status stays "Under Verification" throughout) - that
failure is the whole point of pre-writing this regression test.

Usage:
    pip install requests
    python task08_waiting_for_documents.py

Requires pythonTests/TempTest.py to have been run at least once already
(creates/role-assigns the fixed test accounts) and the Spring Boot app
running on http://localhost:8080.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
from common import (  # noqa: E402
    call, record, section, skip, guarded, setup_users, create_application,
    upload_document, history_for_application, cleanup_application, print_summary,
)

users = setup_users()

# ---------------------------------------------------------------------------
# Setup: drive an application to Under Verification (submit + processor claim).
# ---------------------------------------------------------------------------
section("Task 8: setup - applicant submits, processor claims")

app = create_application(users.applicant, label="create application for waiting-for-documents check")
if not app:
    skip("Task 8 checks skipped, could not create the application")
else:
    app_id = app["id"]
    doc_ids = []

    guarded(
        f"/applications/{app_id}", users.applicant.token,
        lambda: call("PATCH", f"/applications/submit/{app_id}", token=users.applicant.token, expect=200,
                     label="applicant submits application"),
        "submit application for waiting-for-documents check",
    )
    guarded(
        f"/applications/{app_id}", users.admin.token,
        lambda: call("POST", f"/processor/claim/{app_id}", token=users.processor.token, expect=200,
                     label="processor claims the application"),
        "processor claims the application",
    )

    # -----------------------------------------------------------------
    # requestDocuments() sets "Waiting for Documents"
    # -----------------------------------------------------------------
    section("Task 8: requestDocuments() sets status to 'Waiting for Documents'")

    r = call("PATCH", f"/documents/applications/{app_id}/request-documents", token=users.processor.token,
              json={"message": "please upload PAN card, salary slip, and address proof"}, expect=200,
              label="processor requests documents")
    if r.ok:
        record(r.json().get("status") == "Waiting for Documents",
               f"status is 'Waiting for Documents' (got {r.json().get('status')!r})")

    # -----------------------------------------------------------------
    # Option (b): no functional/access difference from Under Verification
    # while in this status - applicant/processor can still do everything
    # they normally could.
    # -----------------------------------------------------------------
    section("Task 8: no functional difference from Under Verification while waiting")

    call("GET", f"/applications/{app_id}", token=users.applicant.token, expect=200,
         label="owning applicant can still read the application while Waiting for Documents")
    call("GET", f"/applications/{app_id}", token=users.processor.token, expect=200,
         label="assigned processor can still read the application while Waiting for Documents")
    call("GET", f"/applications/{app_id}", token=users.processor2.token, expect=403,
         label="unassigned processor2 still cannot access it (unchanged access rule)")

    r = call("GET", "/applications", token=users.processor.token, params={"size": 200}, expect=200,
              label="assigned processor's own application list still includes it")
    if r.ok:
        from common import page_content
        ids_visible = [a["id"] for a in page_content(r)]
        record(app_id in ids_visible, "the Waiting-for-Documents application is still in the processor's own list")

    # -----------------------------------------------------------------
    # Uploading only SOME of the required types does not revert the status
    # -----------------------------------------------------------------
    section("Task 8: uploading only some required types does not yet revert the status")

    r = upload_document(app_id, users.applicant.token, "PAN_CARD", label="upload PAN_CARD (1 of 3)")
    if r.ok:
        doc_ids.append(r.json()["id"])

    r = call("GET", f"/applications/{app_id}", token=users.admin.token, expect=200,
              label="check status after uploading only 1 of 3 required types")
    if r.ok:
        record(r.json().get("status") == "Waiting for Documents",
               f"status is still 'Waiting for Documents' with only 1/3 types uploaded (got {r.json().get('status')!r})")

    # -----------------------------------------------------------------
    # Uploading all 3 required types (all PENDING/"unverified") reverts
    # status back to Under Verification automatically.
    # -----------------------------------------------------------------
    section("Task 8: uploading all 3 required types (still PENDING) auto-reverts to Under Verification")

    for doc_type in ("SALARY_SLIP", "ADDRESS_PROOF"):
        r = upload_document(app_id, users.applicant.token, doc_type, label=f"upload {doc_type} (completing the set)")
        if r.ok:
            doc_ids.append(r.json()["id"])

    r = call("GET", f"/applications/{app_id}", token=users.admin.token, expect=200,
              label="check status after all 3 required types are uploaded (still PENDING)")
    if r.ok:
        record(r.json().get("status") == "Under Verification",
               f"status auto-reverted to 'Under Verification' (got {r.json().get('status')!r})")

        entries = history_for_application(app_id, users.admin.token)
        resubmitted_entries = [h for h in entries if h.get("action") == "DOCUMENTS_RESUBMITTED"]
        record(len(resubmitted_entries) == 1,
               f"exactly one DOCUMENTS_RESUBMITTED history entry was logged (found {len(resubmitted_entries)})")

    # -----------------------------------------------------------------
    # Sanity: a REJECTED duplicate of a type doesn't block the revert as
    # long as a PENDING/VERIFIED one of that type also exists.
    # -----------------------------------------------------------------
    section("Task 8: a REJECTED document doesn't block the auto-revert if a non-rejected one of that type exists")

    r2 = call("PATCH", f"/documents/applications/{app_id}/request-documents", token=users.processor.token,
               json={"message": "please recheck salary slip"}, expect=200,
               label="processor requests documents again")
    if r2.ok:
        record(r2.json().get("status") == "Waiting for Documents", "status is 'Waiting for Documents' again")

        salary_doc = next((d for d in r2.json().get("documents", []) if d.get("documentType") == "SALARY_SLIP"), None)
        if salary_doc:
            call("PATCH", f"/documents/{salary_doc['id']}", token=users.processor.token,
                 json={"verificationStatus": "REJECTED"}, expect=200,
                 label="processor rejects the existing SALARY_SLIP")

            r3 = upload_document(app_id, users.applicant.token, "SALARY_SLIP",
                                   label="applicant uploads a fresh SALARY_SLIP after the rejection")
            if r3.ok:
                doc_ids.append(r3.json()["id"])

            r4 = call("GET", f"/applications/{app_id}", token=users.admin.token, expect=200,
                       label="check status after re-uploading the rejected type")
            if r4.ok:
                record(r4.json().get("status") == "Under Verification",
                       f"status reverted to 'Under Verification' despite the older REJECTED salary slip "
                       f"still existing (got {r4.json().get('status')!r})")
        else:
            skip("REJECTED-doesn't-block-revert check skipped, could not find the SALARY_SLIP document")

    cleanup_application(app_id, users.admin, doc_ids=doc_ids)

print_summary()
