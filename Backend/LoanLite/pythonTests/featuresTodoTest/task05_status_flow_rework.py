"""
todo/featuresTodo.csv - Task 5: Rework the processor/underwriter status flow
and add a real underwriter decision endpoint.

Design under test (see the CSV row for full background - this is the
largest task in the backlog, bundling a status rename with two ownership
fixes and one brand-new endpoint):

1. Status renames (source of truth, confirmed with the user):
     Submitted -> processor claims -> "Under Verification" (was "In Review")
     processor verifies -> "Verified" (was "Ready for Underwriter")
     underwriter claims -> "Under Review" (was "In Underwriting Review")
     underwriter decides -> "Accepted" / "Rejected" (new, terminal)
   Draft/Submitted/Withdrawn are unchanged.

2. "Waiting for Documents" is REMOVED entirely. ProcessorController.verifyApplication()
   must return 400 (not change status) when verification can't proceed, instead
   of moving the application to that now-gone status. DocumentController.requestDocuments()
   becomes a pure notification action - it must NOT touch status at all anymore.

3. Verification strictness: verifyApplication() must require every required
   document type (PAN_CARD, SALARY_SLIP, ADDRESS_PROOF) to have an uploaded
   document whose verificationStatus is exactly VERIFIED - not merely
   "present and not REJECTED" as today. A PENDING document must block
   verification (400) exactly like a REJECTED one does.

4. Ownership gap fix: verifyApplication() and requestDocuments() currently
   have no check that the caller is the processor actually ASSIGNED to the
   application (role-gated only). Both must 403 an unassigned processor via
   LoanApplicationAccessGuard.isAssignedProcessor().

5. New endpoint: an underwriter decision action. The CSV proposes (with an
   "e.g.", i.e. not fully locked in) POST /api/underwriter/applications/{id}/decision,
   UNDERWRITER-only, ownership-checked to the assigned underwriter, requiring
   the application's current status to be "Under Review" (400 otherwise),
   accepting a decision value (ACCEPTED or REJECTED, 400 for anything else)
   plus optional comments, then setting status to Accepted/Rejected and
   populating decision/decisionComments.

The endpoint path, the exact request/response body keys for the decision
action, and the assumption that decisionComments is populated straight from
whatever comments key is used, are THIS TEST'S ASSUMPTIONS (see the
DECISION_* constants below) - not yet confirmed against a real
implementation. Update them here if the real endpoint differs, the
underlying behavior being tested (rename, strictness, ownership, terminal
decision) does not depend on getting these exactly right.

Usage:
    pip install requests
    python task05_status_flow_rework.py

Requires pythonTests/TempTest.py to have been run at least once already
and the Spring Boot app running on http://localhost:8080.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
from common import (  # noqa: E402
    call, record, section, skip, guarded, setup_users, create_application,
    upload_document, cleanup_application, print_summary,
)

# --- assumed status strings (the rename this task performs) ---
STATUS_SUBMITTED = "Submitted"
STATUS_UNDER_VERIFICATION = "Under Verification"   # was "In Review"
STATUS_VERIFIED = "Verified"                       # was "Ready for Underwriter"
STATUS_UNDER_REVIEW = "Under Review"               # was "In Underwriting Review"
STATUS_ACCEPTED = "Accepted"
STATUS_REJECTED = "Rejected"
REMOVED_STATUS_WAITING_FOR_DOCS = "Waiting for Documents"  # must never appear again

REQUIRED_DOCUMENT_TYPES = ("PAN_CARD", "SALARY_SLIP", "ADDRESS_PROOF")

# --- assumed new decision endpoint shape (not locked in, see docstring) ---
DECISION_PATH = "/underwriter/applications/{id}/decision"
DECISION_BODY_KEY = "decision"
COMMENTS_BODY_KEY = "comments"
DECISION_VALUE_ACCEPT = "ACCEPTED"
DECISION_VALUE_REJECT = "REJECTED"

users = setup_users()


def get_application(app_id, token):
    r = call("GET", f"/applications/{app_id}", token=token, expect=200,
             label=f"fetch application {app_id}")
    return r.json() if r.ok else None


def get_status(app_id, token):
    app = get_application(app_id, token)
    return app.get("status") if app else None


def set_document_status(doc_id, status, token=None, expect=200, label=None):
    return call("PATCH", f"/documents/{doc_id}", token=token or users.processor.token,
                json={"verificationStatus": status}, expect=expect,
                label=label or f"mark document {doc_id} {status}")


def advance_to_under_verification(label_suffix):
    """applicant creates + submits, processor claims -> returns app_id or None."""
    app = create_application(users.applicant, label=f"create application ({label_suffix})")
    if not app:
        return None
    app_id = app["id"]
    guarded(
        f"/applications/{app_id}", users.applicant.token,
        lambda: call("PATCH", f"/applications/submit/{app_id}", token=users.applicant.token, expect=200,
                     label=f"applicant submits application ({label_suffix})"),
        f"submit application ({label_suffix})",
    )
    guarded(
        f"/applications/{app_id}", users.admin.token,
        lambda: call("POST", f"/processor/claim/{app_id}", token=users.processor.token, expect=200,
                     label=f"processor claims application ({label_suffix})"),
        f"claim application ({label_suffix})",
    )
    return app_id


def upload_and_mark(app_id, statuses_by_type, label_suffix):
    """Uploads all 3 required doc types, then individually marks each one's
    verificationStatus per statuses_by_type (dict: doc_type -> status or None
    to leave PENDING). Returns the list of created document ids."""
    doc_ids = []
    for doc_type in REQUIRED_DOCUMENT_TYPES:
        r = upload_document(app_id, users.applicant.token, doc_type,
                             label=f"upload {doc_type} ({label_suffix})")
        if not r.ok:
            continue
        doc_id = r.json()["id"]
        doc_ids.append(doc_id)
        target_status = statuses_by_type.get(doc_type)
        if target_status:
            guarded(
                f"/documents/{doc_id}", users.admin.token,
                lambda doc_id=doc_id, target_status=target_status: set_document_status(
                    doc_id, target_status, label=f"mark {doc_type} {target_status} ({label_suffix})"),
                f"mark {doc_type} {target_status} ({label_suffix})",
            )
    return doc_ids


# ---------------------------------------------------------------------------
# Section A: full happy path through every renamed status, ending in a decision
# ---------------------------------------------------------------------------
section("Task 5: full happy-path lifecycle through the renamed statuses")

app_a = advance_to_under_verification("section A")
if not app_a:
    skip("Section A skipped, could not create/advance the application")
else:
    record(get_status(app_a, users.admin.token) == STATUS_UNDER_VERIFICATION,
           f"status after processor claim is '{STATUS_UNDER_VERIFICATION}' (renamed from 'In Review')")

    doc_ids_a = upload_and_mark(app_a, {t: "VERIFIED" for t in REQUIRED_DOCUMENT_TYPES}, "section A")

    guarded(
        f"/applications/{app_a}", users.admin.token,
        lambda: call("POST", f"/processor/applications/{app_a}/verify", token=users.processor.token, expect=200,
                     label="processor verifies application (all docs VERIFIED)"),
        "processor verifies application (section A)",
    )
    record(get_status(app_a, users.admin.token) == STATUS_VERIFIED,
           f"status after successful verify is '{STATUS_VERIFIED}' (renamed from 'Ready for Underwriter')")

    r = call("GET", "/underwriter/work-list", token=users.underwriter.token, expect=200,
              label="underwriter reads work-list")
    record(r.ok and any(a["id"] == app_a for a in r.json()),
           f"application appears in underwriter work-list once status is '{STATUS_VERIFIED}'")

    guarded(
        f"/applications/{app_a}", users.admin.token,
        lambda: call("POST", f"/underwriter/claim/{app_a}", token=users.underwriter.token, expect=200,
                     label="underwriter claims application"),
        "underwriter claims application (section A)",
    )
    record(get_status(app_a, users.admin.token) == STATUS_UNDER_REVIEW,
           f"status after underwriter claim is '{STATUS_UNDER_REVIEW}' (renamed from 'In Underwriting Review')")

    guarded(
        f"/applications/{app_a}", users.admin.token,
        lambda: call("POST", DECISION_PATH.format(id=app_a), token=users.underwriter.token,
                     json={DECISION_BODY_KEY: DECISION_VALUE_ACCEPT, COMMENTS_BODY_KEY: "Meets all criteria."},
                     expect=200, label="assigned underwriter accepts the application"),
        "underwriter accepts application (section A)",
    )
    final_app_a = get_application(app_a, users.admin.token)
    if final_app_a:
        record(final_app_a.get("status") == STATUS_ACCEPTED,
               f"status after ACCEPT decision is '{STATUS_ACCEPTED}' (got {final_app_a.get('status')})")
        record(final_app_a.get("decision") == DECISION_VALUE_ACCEPT,
               f"decision field is '{DECISION_VALUE_ACCEPT}' (got {final_app_a.get('decision')})")

    cleanup_application(app_a, users.admin, doc_ids=doc_ids_a)

# ---------------------------------------------------------------------------
# Section B: "Waiting for Documents" is gone - verify() 400s instead, never
# leaves that status behind, for each of the three ways it can fail
# ---------------------------------------------------------------------------
section("Task 5: verify() rejects with 400 instead of 'Waiting for Documents' (missing doc type)")

app_b1 = advance_to_under_verification("section B1 - missing type")
if not app_b1:
    skip("Section B1 skipped, could not create/advance the application")
else:
    # Only upload 2 of the 3 required types, both VERIFIED - ADDRESS_PROOF is missing entirely.
    doc_ids_b1 = []
    for doc_type in ("PAN_CARD", "SALARY_SLIP"):
        r = upload_document(app_b1, users.applicant.token, doc_type, label=f"upload {doc_type} (section B1)")
        if r.ok:
            doc_id = r.json()["id"]
            doc_ids_b1.append(doc_id)
            guarded(
                f"/documents/{doc_id}", users.admin.token,
                lambda doc_id=doc_id, doc_type=doc_type: set_document_status(
                    doc_id, "VERIFIED", label=f"mark {doc_type} VERIFIED (section B1)"),
                f"mark {doc_type} VERIFIED (section B1)",
            )

    guarded(
        f"/applications/{app_b1}", users.admin.token,
        lambda: call("POST", f"/processor/applications/{app_b1}/verify", token=users.processor.token, expect=400,
                     label="processor verifies application with a missing required document type (should be 400)"),
        "verify with missing document type (section B1)",
    )
    status_b1 = get_status(app_b1, users.admin.token)
    record(status_b1 != REMOVED_STATUS_WAITING_FOR_DOCS, "status is not the removed 'Waiting for Documents' value")
    record(status_b1 == STATUS_UNDER_VERIFICATION,
           f"status is unchanged, still '{STATUS_UNDER_VERIFICATION}' (got {status_b1})")

    cleanup_application(app_b1, users.admin, doc_ids=doc_ids_b1)

section("Task 5: verify() rejects with 400 (a required document still PENDING, not individually VERIFIED)")

app_b2 = advance_to_under_verification("section B2 - pending doc")
if not app_b2:
    skip("Section B2 skipped, could not create/advance the application")
else:
    # All 3 uploaded, but left PENDING - none individually marked VERIFIED.
    doc_ids_b2 = upload_and_mark(app_b2, {}, "section B2")

    guarded(
        f"/applications/{app_b2}", users.admin.token,
        lambda: call("POST", f"/processor/applications/{app_b2}/verify", token=users.processor.token, expect=400,
                     label="processor verifies application with a PENDING (not individually verified) document (should be 400)"),
        "verify with a PENDING document (section B2)",
    )
    status_b2 = get_status(app_b2, users.admin.token)
    record(status_b2 != REMOVED_STATUS_WAITING_FOR_DOCS, "status is not the removed 'Waiting for Documents' value")
    record(status_b2 == STATUS_UNDER_VERIFICATION,
           f"status is unchanged, still '{STATUS_UNDER_VERIFICATION}' (got {status_b2}) - "
           f"PENDING must block verification exactly like REJECTED does")

    cleanup_application(app_b2, users.admin, doc_ids=doc_ids_b2)

section("Task 5: verify() rejects with 400 (a required document REJECTED)")

app_b3 = advance_to_under_verification("section B3 - rejected doc")
if not app_b3:
    skip("Section B3 skipped, could not create/advance the application")
else:
    doc_ids_b3 = upload_and_mark(
        app_b3,
        {"PAN_CARD": "VERIFIED", "SALARY_SLIP": "VERIFIED", "ADDRESS_PROOF": "REJECTED"},
        "section B3",
    )

    guarded(
        f"/applications/{app_b3}", users.admin.token,
        lambda: call("POST", f"/processor/applications/{app_b3}/verify", token=users.processor.token, expect=400,
                     label="processor verifies application with a REJECTED document (should be 400)"),
        "verify with a REJECTED document (section B3)",
    )
    status_b3 = get_status(app_b3, users.admin.token)
    record(status_b3 != REMOVED_STATUS_WAITING_FOR_DOCS, "status is not the removed 'Waiting for Documents' value")
    record(status_b3 == STATUS_UNDER_VERIFICATION,
           f"status is unchanged, still '{STATUS_UNDER_VERIFICATION}' (got {status_b3})")

    cleanup_application(app_b3, users.admin, doc_ids=doc_ids_b3)

# ---------------------------------------------------------------------------
# Section C: ownership checks added to verify() and requestDocuments()
# ---------------------------------------------------------------------------
section("Task 5: verify() and request-documents are ownership-checked to the assigned processor")

app_c = advance_to_under_verification("section C")
if not app_c:
    skip("Section C skipped, could not create/advance the application")
else:
    doc_ids_c = upload_and_mark(app_c, {t: "VERIFIED" for t in REQUIRED_DOCUMENT_TYPES}, "section C")

    call("POST", f"/processor/applications/{app_c}/verify", token=users.processor2.token, expect=403,
         label="UNASSIGNED processor2 verifies application (should be forbidden)")
    call("PATCH", f"/documents/applications/{app_c}/request-documents", token=users.processor2.token,
         json={"message": "please resend"}, expect=403,
         label="UNASSIGNED processor2 requests documents (should be forbidden)")

    status_before_request = get_status(app_c, users.admin.token)
    call("PATCH", f"/documents/applications/{app_c}/request-documents", token=users.processor.token,
         json={"message": "please resend salary slip"}, expect=200,
         label="ASSIGNED processor requests documents")
    status_after_request = get_status(app_c, users.admin.token)
    record(status_after_request == status_before_request,
           f"request-documents does not change status (before={status_before_request!r}, "
           f"after={status_after_request!r}) - it's a pure notification action now")
    record(status_after_request != REMOVED_STATUS_WAITING_FOR_DOCS,
           "request-documents never sets the removed 'Waiting for Documents' status")

    guarded(
        f"/applications/{app_c}", users.admin.token,
        lambda: call("POST", f"/processor/applications/{app_c}/verify", token=users.processor.token, expect=200,
                     label="ASSIGNED processor verifies application (should still work)"),
        "assigned processor verifies (section C)",
    )

    cleanup_application(app_c, users.admin, doc_ids=doc_ids_c)

# ---------------------------------------------------------------------------
# Section D: the new underwriter decision endpoint - negative cases first
# ---------------------------------------------------------------------------
section("Task 5: underwriter decision endpoint - access control and preconditions")

app_d = advance_to_under_verification("section D")
if not app_d:
    skip("Section D skipped, could not create/advance the application")
else:
    doc_ids_d = upload_and_mark(app_d, {t: "VERIFIED" for t in REQUIRED_DOCUMENT_TYPES}, "section D")
    guarded(
        f"/applications/{app_d}", users.admin.token,
        lambda: call("POST", f"/processor/applications/{app_d}/verify", token=users.processor.token, expect=200,
                     label="processor verifies application (section D)"),
        "processor verifies (section D)",
    )

    # Not yet claimed by any underwriter - ownership is checked before the status precondition
    # (same order as every other ownership+state check in this codebase, e.g.
    # LoanApplicationController.update()'s hasAccess() check before its Draft-status check), so
    # a caller who isn't the assigned underwriter gets 403 here, not 400 - nobody is "the
    # assigned underwriter" on an unclaimed application, this underwriter included. The 400
    # "wrong status" case is exercised later once this same underwriter actually IS assigned but
    # the application is no longer Under Review (after a decision has already been made).
    call("POST", DECISION_PATH.format(id=app_d), token=users.underwriter.token,
         json={DECISION_BODY_KEY: DECISION_VALUE_ACCEPT}, expect=403,
         label="decision attempted by an underwriter not yet assigned (application isn't claimed yet, should be forbidden)")

    guarded(
        f"/applications/{app_d}", users.admin.token,
        lambda: call("POST", f"/underwriter/claim/{app_d}", token=users.underwriter.token, expect=200,
                     label="underwriter claims application (section D)"),
        "underwriter claims (section D)",
    )

    call("POST", DECISION_PATH.format(id=app_d), expect=401,
         label="unauthenticated posts a decision (should be unauthorized)")
    for role_label, token in (("applicant", users.applicant.token), ("processor", users.processor.token),
                               ("admin", users.admin.token)):
        call("POST", DECISION_PATH.format(id=app_d), token=token,
             json={DECISION_BODY_KEY: DECISION_VALUE_ACCEPT}, expect=403,
             label=f"{role_label} posts a decision (should be forbidden, UNDERWRITER only)")
    call("POST", DECISION_PATH.format(id=app_d), token=users.underwriter2.token,
         json={DECISION_BODY_KEY: DECISION_VALUE_ACCEPT}, expect=403,
         label="UNASSIGNED underwriter2 posts a decision (should be forbidden)")
    call("POST", DECISION_PATH.format(id=app_d), token=users.underwriter.token,
         json={DECISION_BODY_KEY: "MAYBE_LATER"}, expect=400,
         label="assigned underwriter posts an invalid decision value (should be 400)")

    record(get_status(app_d, users.admin.token) == STATUS_UNDER_REVIEW,
           "status is still 'Under Review' after all the rejected decision attempts above")

    guarded(
        f"/applications/{app_d}", users.admin.token,
        lambda: call("POST", DECISION_PATH.format(id=app_d), token=users.underwriter.token,
                     json={DECISION_BODY_KEY: DECISION_VALUE_REJECT, COMMENTS_BODY_KEY: "Insufficient income."},
                     expect=200, label="assigned underwriter rejects the application"),
        "underwriter rejects application (section D)",
    )
    final_app_d = get_application(app_d, users.admin.token)
    if final_app_d:
        record(final_app_d.get("status") == STATUS_REJECTED,
               f"status after REJECT decision is '{STATUS_REJECTED}' (got {final_app_d.get('status')})")
        record(final_app_d.get("decision") == DECISION_VALUE_REJECT,
               f"decision field is '{DECISION_VALUE_REJECT}' (got {final_app_d.get('decision')})")
        record(bool((final_app_d.get("decisionComments") or "").strip()),
               "decisionComments was populated from the request")

    call("POST", DECISION_PATH.format(id=app_d), token=users.underwriter.token,
         json={DECISION_BODY_KEY: DECISION_VALUE_ACCEPT}, expect=400,
         label="deciding again after already Rejected (should be 400, no longer 'Under Review')")

    cleanup_application(app_d, users.admin, doc_ids=doc_ids_d)

print_summary()
