"""
todo/featuresTodo.csv - Task 1: Automate application-history writes.

Design under test (see the CSV row for full background): the backend
itself writes an ApplicationHistory row as a side effect of these actions,
via ApplicationHistoryService directly (not through the ADMIN-only HTTP
endpoint, which must stay locked down and untouched by this feature):

    LoanApplicationController.submitApplication()   -> ACTION_SUBMITTED
    LoanApplicationController.withdrawApplication()  -> ACTION_WITHDRAWN
    ProcessorController.claimApplication()           -> ACTION_PROCESSOR_CLAIMED
    ProcessorController.verifyApplication()          -> ACTION_PROCESSOR_VERIFIED
    UnderwriterController.claimApplication()         -> ACTION_UNDERWRITER_CLAIMED
    DocumentController.updateDocumentStatus()        -> ACTION_DOCUMENT_VERIFIED / ACTION_DOCUMENT_REJECTED

The exact action-name strings below are this test's ASSUMPTION, not yet
confirmed against a real implementation (see the conversation - three open
design questions were still unanswered when this file was written). If the
real implementation uses different strings, update the ACTION_* constants
here to match rather than rewriting the checks - everything else (that an
entry appears at all, attributed to the right user, on the right
application, with non-blank details) holds regardless of naming.

Usage:
    pip install requests
    python task01_history_automation.py

Requires pythonTests/TempTest.py to have been run at least once already
(creates/role-assigns the fixed test accounts) and the Spring Boot app
running on http://localhost:8080.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
from common import (  # noqa: E402
    call, record, section, skip, guarded, setup_users, create_application,
    upload_document, upload_all_required_documents, history_for_application,
    cleanup_application, print_summary,
)

# Assumed action-name strings - update to match the real implementation.
ACTION_SUBMITTED = "SUBMITTED"
ACTION_WITHDRAWN = "WITHDRAWN"
ACTION_PROCESSOR_CLAIMED = "PROCESSOR_CLAIMED"
ACTION_PROCESSOR_VERIFIED = "PROCESSOR_VERIFIED"
ACTION_UNDERWRITER_CLAIMED = "UNDERWRITER_CLAIMED"
ACTION_DOCUMENT_VERIFIED = "DOCUMENT_VERIFIED"
ACTION_DOCUMENT_REJECTED = "DOCUMENT_REJECTED"

users = setup_users()


def latest_entry_for(app_id, token, action=None):
    entries = history_for_application(app_id, token)
    if action is not None:
        entries = [e for e in entries if (e.get("action") or "").upper() == action.upper()]
    if not entries:
        return None
    return max(entries, key=lambda e: e.get("createdAt") or "")


def assert_entry_recorded(app_id, token, action, expected_user_id, what):
    entry = latest_entry_for(app_id, token, action)
    if record(entry is not None, f"{what}: a '{action}' history entry exists"):
        record((entry.get("user") or {}).get("id") == expected_user_id,
               f"{what}: '{action}' entry is attributed to the acting user "
               f"(expected {expected_user_id}, got {(entry.get('user') or {}).get('id')})")
        record(entry.get("applicationId") == app_id,
               f"{what}: '{action}' entry references application {app_id}")
        record(bool((entry.get("details") or "").strip()),
               f"{what}: '{action}' entry has non-blank details")
    return entry


def count_entries(app_id, token):
    return len(history_for_application(app_id, token))


# ---------------------------------------------------------------------------
# Regression guard: this feature must NOT reopen the ADMIN-only write lockdown
# ---------------------------------------------------------------------------
section("Regression: manual history writes stay ADMIN-only after automation lands")

probe_app = create_application(users.applicant, label="create application to probe manual history writes")
if not probe_app:
    skip("Manual-write regression checks skipped, could not create the application")
else:
    for role_label, user in (("applicant", users.applicant), ("processor", users.processor),
                              ("underwriter", users.underwriter)):
        call("POST", "/application-history", token=user.token,
             json={"application": {"id": probe_app["id"]}, "action": "FORGED", "details": "should be rejected"},
             expect=403, label=f"{role_label} POSTs a manual history entry directly (should still be forbidden)")
    cleanup_application(probe_app["id"], users.admin)

# ---------------------------------------------------------------------------
# submit / withdraw -> ACTION_SUBMITTED / ACTION_WITHDRAWN, applicant-attributed
# ---------------------------------------------------------------------------
section("Task 1: submit and withdraw write history automatically")

app = create_application(users.applicant, label="create application for submit/withdraw history check")
if not app:
    skip("Submit/withdraw history checks skipped, could not create the application")
else:
    app_id = app["id"]
    before = count_entries(app_id, users.applicant.token)
    record(before == 0, f"no history entries exist yet for a freshly created Draft application (found {before})")

    call("PATCH", f"/applications/submit/{app_id}", token=users.applicant.token, expect=200,
         label="applicant submits the application")
    assert_entry_recorded(app_id, users.applicant.token, ACTION_SUBMITTED, users.applicant.id, "submit")

    call("PATCH", f"/applications/withdraw/{app_id}", token=users.applicant.token, expect=200,
         label="applicant withdraws the application")
    assert_entry_recorded(app_id, users.applicant.token, ACTION_WITHDRAWN, users.applicant.id, "withdraw")

    after = count_entries(app_id, users.admin.token)
    record(after == before + 2, f"exactly 2 history entries were added by submit+withdraw (found {after - before})")

    cleanup_application(app_id, users.admin)

# ---------------------------------------------------------------------------
# A rejected action (403) must NOT write a history entry
# ---------------------------------------------------------------------------
section("Task 1: a forbidden action does not write a history entry")

neg_app = create_application(users.applicant, label="create application for negative-case history check")
if not neg_app:
    skip("Negative-case history check skipped, could not create the application")
else:
    neg_app_id = neg_app["id"]
    before = count_entries(neg_app_id, users.admin.token)

    call("PATCH", f"/applications/submit/{neg_app_id}", token=users.applicant2.token, expect=403,
         label="unrelated applicant2 tries to submit someone else's application (should be forbidden)")

    after = count_entries(neg_app_id, users.admin.token)
    record(after == before, f"no history entry was written by the rejected submit attempt (before={before}, after={after})")

    cleanup_application(neg_app_id, users.admin)

# ---------------------------------------------------------------------------
# processor claim / verify -> ACTION_PROCESSOR_CLAIMED / ACTION_PROCESSOR_VERIFIED
# ---------------------------------------------------------------------------
section("Task 1: processor claim and verify write history automatically")

proc_app = create_application(users.applicant, label="create application for processor history check")
if not proc_app:
    skip("Processor history checks skipped, could not create the application")
else:
    proc_app_id = proc_app["id"]
    doc_ids = upload_all_required_documents(proc_app_id, users.applicant.token)

    guarded(
        f"/applications/{proc_app_id}", users.applicant.token,
        lambda: call("PATCH", f"/applications/submit/{proc_app_id}", token=users.applicant.token, expect=200,
                     label="applicant submits application for processor history check"),
        "submit application for processor history check",
    )
    guarded(
        f"/applications/{proc_app_id}", users.admin.token,
        lambda: call("POST", f"/processor/claim/{proc_app_id}", token=users.processor.token, expect=200,
                     label="processor claims the application"),
        "processor claims the application",
    )
    assert_entry_recorded(proc_app_id, users.admin.token, ACTION_PROCESSOR_CLAIMED, users.processor.id, "processor claim")

    # verifyApplication() requires every required document to be individually VERIFIED, not just
    # present and not-REJECTED (featuresTodo.csv task 5) - mark them before verifying.
    for doc_id in doc_ids:
        guarded(
            f"/documents/{doc_id}", users.admin.token,
            lambda doc_id=doc_id: call("PATCH", f"/documents/{doc_id}", token=users.processor.token,
                                        json={"verificationStatus": "VERIFIED"}, expect=200,
                                        label=f"mark document {doc_id} VERIFIED before processor verify"),
            f"mark document {doc_id} VERIFIED before processor verify",
        )

    guarded(
        f"/applications/{proc_app_id}", users.admin.token,
        lambda: call("POST", f"/processor/applications/{proc_app_id}/verify", token=users.processor.token, expect=200,
                     label="processor verifies the application"),
        "processor verifies the application",
    )
    assert_entry_recorded(proc_app_id, users.admin.token, ACTION_PROCESSOR_VERIFIED, users.processor.id, "processor verify")

    # ---------------------------------------------------------------------
    # underwriter claim -> ACTION_UNDERWRITER_CLAIMED
    # ---------------------------------------------------------------------
    section("Task 1: underwriter claim writes history automatically")

    guarded(
        f"/applications/{proc_app_id}", users.admin.token,
        lambda: call("POST", f"/underwriter/claim/{proc_app_id}", token=users.underwriter.token, expect=200,
                     label="underwriter claims the application"),
        "underwriter claims the application",
    )
    assert_entry_recorded(proc_app_id, users.admin.token, ACTION_UNDERWRITER_CLAIMED, users.underwriter.id,
                           "underwriter claim")

    # ---------------------------------------------------------------------
    # document status update -> ACTION_DOCUMENT_VERIFIED / ACTION_DOCUMENT_REJECTED
    # ---------------------------------------------------------------------
    section("Task 1: document verification writes history automatically")

    if len(doc_ids) >= 2:
        verified_doc_id, rejected_doc_id = doc_ids[0], doc_ids[1]

        guarded(
            f"/documents/{verified_doc_id}", users.admin.token,
            lambda: call("PATCH", f"/documents/{verified_doc_id}", token=users.processor.token,
                         json={"verificationStatus": "VERIFIED"}, expect=200,
                         label="processor marks a document VERIFIED"),
            "processor marks a document VERIFIED",
        )
        assert_entry_recorded(proc_app_id, users.admin.token, ACTION_DOCUMENT_VERIFIED, users.processor.id,
                               "document verified")

        guarded(
            f"/documents/{rejected_doc_id}", users.admin.token,
            lambda: call("PATCH", f"/documents/{rejected_doc_id}", token=users.processor.token,
                         json={"verificationStatus": "REJECTED"}, expect=200,
                         label="processor marks a document REJECTED"),
            "processor marks a document REJECTED",
        )
        assert_entry_recorded(proc_app_id, users.admin.token, ACTION_DOCUMENT_REJECTED, users.processor.id,
                               "document rejected")
    else:
        skip("Document verification history checks skipped, fewer than 2 documents were uploaded")

    cleanup_application(proc_app_id, users.admin, doc_ids=doc_ids)

print_summary()
