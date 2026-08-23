"""
todo/backendTodo.csv - Task 1: Add ownership scoping to
DocumentController.update (PUT /api/documents/{id}).

Design under test (see the CSV row for full background): today this
endpoint is role-gated to @PreAuthorize("hasAnyRole('PROCESSOR','UNDERWRITER',
'ADMIN')") but has NO ownership check at all - any processor, any
underwriter, or admin can overwrite verificationStatus/remarks/filePath/
application on ANY document in the system, not just one on an application
they're assigned to.

The agreed fix (see conversation, not just the CSV): keep the endpoint as
a general-purpose PUT, but add the same isAssignedProcessor(doc.getApplication(),
caller) OR isAssignedUnderwriter(...) OR isAdmin(caller) ownership check
already used by DocumentController.updateDocumentStatus() and
requestDocuments() - 403 for staff who aren't assigned to the document's
application. This does NOT change the role gate itself - a ROLE_USER
caller still gets 403 from @PreAuthorize before the method body runs, no
ownership-based override for applicants.

Until this lands, the "unassigned processor2/underwriter2" checks below
are EXPECTED to FAIL (today they get 200, this file asserts the desired
post-fix 403) - that failure is the whole point of pre-writing this
regression test.

Usage:
    pip install requests
    python task01_document_put_ownership.py

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
# PROCESSOR (not processor2) claims it. Underwriter never claims it here -
# there's no need to advance status further, PUT /api/documents/{id} isn't
# status-gated.
# ---------------------------------------------------------------------------
section("Task 1: setup - applicant submits, uploads a document, processor claims")

app = create_application(users.applicant, label="create application for document-PUT-ownership check")
if not app:
    skip("Task 1 checks skipped, could not create the application")
else:
    app_id = app["id"]
    doc_ids = []

    r = upload_document(app_id, users.applicant.token, "PAN_CARD",
                         label="upload PAN_CARD for document-PUT-ownership check")
    doc_id = r.json()["id"] if r.ok else None
    if doc_id:
        doc_ids.append(doc_id)

    guarded(
        f"/applications/{app_id}", users.applicant.token,
        lambda: call("PATCH", f"/applications/submit/{app_id}", token=users.applicant.token, expect=200,
                     label="applicant submits application for document-PUT-ownership check"),
        "submit application for document-PUT-ownership check",
    )
    guarded(
        f"/applications/{app_id}", users.admin.token,
        lambda: call("POST", f"/processor/claim/{app_id}", token=users.processor.token, expect=200,
                     label="processor claims the application"),
        "processor claims the application",
    )

    if not doc_id:
        skip("Task 1 ownership checks skipped, document upload failed")
    else:
        # ---------------------------------------------------------------
        # Negative checks first, so they exercise the ORIGINAL PENDING
        # status rather than depending on the positive check's mutation
        # having already happened.
        # ---------------------------------------------------------------
        section("Task 1: unauthenticated / applicant callers are still rejected")

        call("PUT", f"/documents/{doc_id}", json={"verificationStatus": "VERIFIED"}, expect=401,
             label="unauthenticated PUTs the document (should be unauthorized)")

        call("PUT", f"/documents/{doc_id}", token=users.applicant.token,
             json={"verificationStatus": "VERIFIED"}, expect=403,
             label="owning applicant PUTs their own document (role gate still blocks ROLE_USER entirely)")

        section("Task 1: an unassigned processor/underwriter cannot PUT someone else's document")

        call("PUT", f"/documents/{doc_id}", token=users.processor2.token,
             json={"verificationStatus": "VERIFIED"}, expect=403,
             label="unassigned processor2 PUTs the document (should be forbidden - the fix under test)")

        call("PUT", f"/documents/{doc_id}", token=users.underwriter2.token,
             json={"verificationStatus": "VERIFIED"}, expect=403,
             label="unassigned underwriter2 PUTs the document (should be forbidden - the fix under test)")

        call("PUT", "/documents/999999999", token=users.processor.token,
             json={"verificationStatus": "VERIFIED"}, expect=404,
             label="assigned processor PUTs a nonexistent document (should be not found)")

        # ---------------------------------------------------------------
        # Positive checks last: legitimate assigned-staff and admin paths
        # must keep working after the ownership check is added.
        # ---------------------------------------------------------------
        section("Task 1: the assigned processor and admin can still PUT the document")

        r = call("PUT", f"/documents/{doc_id}", token=users.processor.token,
                  json={"remarks": "looks fine"}, expect=200,
                  label="assigned processor PUTs the document's remarks")
        if r.ok:
            record(r.json().get("remarks") == "looks fine",
                   f"response reflects the new remarks (got {r.json().get('remarks')!r})")

        r = call("PUT", f"/documents/{doc_id}", token=users.admin.token,
                  json={"verificationStatus": "VERIFIED"}, expect=200,
                  label="admin PUTs the document (admin has no ownership restriction)")
        if r.ok:
            record(r.json().get("verificationStatus") == "VERIFIED",
                   f"response reflects the new verificationStatus (got {r.json().get('verificationStatus')!r})")

    cleanup_application(app_id, users.admin, doc_ids=doc_ids)

print_summary()
