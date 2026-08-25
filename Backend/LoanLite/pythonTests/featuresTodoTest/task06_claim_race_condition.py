"""
todo/featuresTodo.csv - Task 6: Fix the claim race condition on processor
and underwriter claim endpoints.

Design under test (see the CSV row for full background): ProcessorController.claimApplication()
and UnderwriterController.claimApplication() both do a plain read-check-then-write with no
concurrency guard - if two callers claim the same application at nearly the same moment,
both can read the same pre-claim status before either write commits, both pass the check,
and both save. The second write silently overwrites the first caller's assignment, but
BOTH callers get back 200 OK today - only the second write's assignment actually persists.

The CSV leaves the exact fix unspecified (two options: an optimistic-locking @Version column
producing a 409 Conflict for the loser, or an atomic conditional UPDATE ... WHERE status = ?
producing a 409/400 for the loser) - deliberately, since that's a design call for whoever
implements this task to make. This test does NOT assume which approach is chosen. It only
asserts the OBSERVABLE property that must hold regardless of approach:

  - When two eligible callers race to claim the same application, EXACTLY ONE of them gets
    a success response (200), and the other gets a NON-success response (this test accepts
    400 or 409 for the loser, since either is a reasonable "someone else already claimed
    this" signal).
  - After the race, the application's processor/underwriter field is set to whichever
    caller actually got the 200 - never left inconsistent with what the winning response
    claimed, and never showing both callers as if it somehow succeeded twice.

This also deliberately avoids depending on Task 5's status renames (In Review -> Under
Verification, Ready for Underwriter -> Verified) since the CSV explicitly notes the race
bug is independent of naming: the underwriter-claim race in Section B discovers whatever
status value verifyApplication() actually produces at runtime instead of hardcoding either
the old or the new name.

Usage:
    pip install requests
    python task06_claim_race_condition.py

Requires pythonTests/TempTest.py to have been run at least once already
and the Spring Boot app running on http://localhost:8080.
"""

import sys
import os
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(__file__))
from common import (  # noqa: E402
    call, record, section, skip, guarded, setup_users, create_application,
    upload_document, cleanup_application, print_summary, BASE, auth, TIMEOUT,
)

import requests  # noqa: E402

REQUIRED_DOCUMENT_TYPES = ("PAN_CARD", "SALARY_SLIP", "AADHAAR_CARD")

users = setup_users()


def race(method, path, token_a, token_b):
    """Fires two requests at path concurrently (one per token) using real
    threads so both are in flight on the wire at roughly the same time, and
    returns (resp_a, resp_b) in the order the tokens were given - NOT the
    order the responses actually arrived, since that's exactly the race
    being tested."""
    def do(token):
        return requests.request(method, f"{BASE}{path}", headers=auth(token), timeout=TIMEOUT)

    with ThreadPoolExecutor(max_workers=2) as pool:
        future_a = pool.submit(do, token_a)
        future_b = pool.submit(do, token_b)
        return future_a.result(), future_b.result()


def get_application(app_id, token):
    r = call("GET", f"/applications/{app_id}", token=token, expect=200,
             label=f"fetch application {app_id}")
    return r.json() if r.ok else None


# ---------------------------------------------------------------------------
# Section A: two processors race to claim the same Submitted application
# ---------------------------------------------------------------------------
section("Task 6: two processors racing to claim the same application")

app_a = create_application(users.applicant, label="create application for processor claim race")
if not app_a:
    skip("Section A skipped, could not create the application")
else:
    app_a_id = app_a["id"]
    guarded(
        f"/applications/{app_a_id}", users.applicant.token,
        lambda: call("PATCH", f"/applications/submit/{app_a_id}", token=users.applicant.token, expect=200,
                     label="applicant submits application for processor claim race"),
        "submit application for processor claim race",
    )

    resp_processor, resp_processor2 = race("POST", f"/processor/claim/{app_a_id}",
                                            users.processor.token, users.processor2.token)
    codes = (resp_processor.status_code, resp_processor2.status_code)
    print(f"  race result: processor -> {codes[0]}, processor2 -> {codes[1]}")

    winners = [i for i, code in enumerate(codes) if code == 200]
    losers = [i for i, code in enumerate(codes) if code != 200]
    record(len(winners) == 1,
           f"exactly one of the two concurrent processor claims succeeded (got {len(winners)} successes: {codes})")
    if losers:
        record(codes[losers[0]] in (400, 409),
               f"the losing claim got a clear conflict/rejection status, not a silent 200 "
               f"(got {codes[losers[0]]}, accepting 400 or 409)")

    winning_user = (users.processor, users.processor2)[winners[0]] if len(winners) == 1 else None
    if winning_user:
        app_after = get_application(app_a_id, users.admin.token)
        if app_after:
            record((app_after.get("processor") or {}).get("id") == winning_user.id,
                   f"the application's assigned processor matches whichever caller actually got 200 "
                   f"(expected {winning_user.id}, got {(app_after.get('processor') or {}).get('id')})")
            record(app_after.get("status") != "Submitted",
                   f"status moved forward off 'Submitted' after the successful claim (got {app_after.get('status')})")
    else:
        skip("Could not determine a single winner (0 or 2 successes) - skipping the post-race application check; "
             "this itself is a failure signal already captured by the 'exactly one succeeded' check above")

    # A third claim attempt (by whichever side lost, or either if the race was inconclusive)
    # against the now-claimed application must not succeed either. The implementation (an atomic
    # conditional UPDATE ... WHERE status = ?) returns 409 uniformly for "0 rows changed" whether
    # that's because a concurrent claim won the race or because the application was already
    # claimed some time ago - both are the same underlying condition, so one status code for both.
    call("POST", f"/processor/claim/{app_a_id}", token=users.processor2.token, expect=409,
         label="a further claim attempt after the application is already claimed (should be 409 conflict, "
               "no longer Submitted)")

    cleanup_application(app_a_id, users.admin)

# ---------------------------------------------------------------------------
# Section B: two underwriters race to claim the same application
# ---------------------------------------------------------------------------
section("Task 6: two underwriters racing to claim the same application")

app_b = create_application(users.applicant, label="create application for underwriter claim race")
if not app_b:
    skip("Section B skipped, could not create the application")
else:
    app_b_id = app_b["id"]
    doc_ids_b = []

    guarded(
        f"/applications/{app_b_id}", users.applicant.token,
        lambda: call("PATCH", f"/applications/submit/{app_b_id}", token=users.applicant.token, expect=200,
                     label="applicant submits application for underwriter claim race"),
        "submit application for underwriter claim race",
    )
    guarded(
        f"/applications/{app_b_id}", users.admin.token,
        lambda: call("POST", f"/processor/claim/{app_b_id}", token=users.processor.token, expect=200,
                     label="processor claims application for underwriter claim race"),
        "processor claims application for underwriter claim race",
    )

    for doc_type in REQUIRED_DOCUMENT_TYPES:
        r = upload_document(app_b_id, users.applicant.token, doc_type,
                             label=f"upload {doc_type} for underwriter claim race")
        if r.ok:
            doc_id = r.json()["id"]
            doc_ids_b.append(doc_id)
            # VERIFIED satisfies both the old ("not REJECTED") and the new, stricter
            # ("must be exactly VERIFIED") verify() logic - deliberately avoids coupling
            # this file to whether Task 5's strictness change has landed yet.
            guarded(
                f"/documents/{doc_id}", users.admin.token,
                lambda doc_id=doc_id: call("PATCH", f"/documents/{doc_id}", token=users.processor.token,
                                            json={"verificationStatus": "VERIFIED"}, expect=200,
                                            label=f"mark document {doc_id} VERIFIED"),
                f"mark document {doc_id} VERIFIED",
            )

    guarded(
        f"/applications/{app_b_id}", users.admin.token,
        lambda: call("POST", f"/processor/applications/{app_b_id}/verify", token=users.processor.token, expect=200,
                     label="processor verifies application for underwriter claim race"),
        "processor verifies application for underwriter claim race",
    )

    pre_race_app = get_application(app_b_id, users.admin.token)
    if not pre_race_app or pre_race_app.get("status") == "Submitted":
        skip("Underwriter claim race skipped, application never reached a claimable-by-underwriter status "
             "(verify likely failed above - see the FAILs recorded for the setup steps)")
    else:
        underwriter_ready_status = pre_race_app["status"]  # whatever verify() actually produced
        print(f"  application reached status '{underwriter_ready_status}' - racing underwriter claims from here")

        resp_underwriter, resp_underwriter2 = race(
            "POST", f"/underwriter/claim/{app_b_id}", users.underwriter.token, users.underwriter2.token)
        codes_u = (resp_underwriter.status_code, resp_underwriter2.status_code)
        print(f"  race result: underwriter -> {codes_u[0]}, underwriter2 -> {codes_u[1]}")

        winners_u = [i for i, code in enumerate(codes_u) if code == 200]
        losers_u = [i for i, code in enumerate(codes_u) if code != 200]
        record(len(winners_u) == 1,
               f"exactly one of the two concurrent underwriter claims succeeded (got {len(winners_u)} successes: {codes_u})")
        if losers_u:
            record(codes_u[losers_u[0]] in (400, 409),
                   f"the losing underwriter claim got a clear conflict/rejection status, not a silent 200 "
                   f"(got {codes_u[losers_u[0]]}, accepting 400 or 409)")

        winning_underwriter = (users.underwriter, users.underwriter2)[winners_u[0]] if len(winners_u) == 1 else None
        if winning_underwriter:
            app_after_u = get_application(app_b_id, users.admin.token)
            if app_after_u:
                record((app_after_u.get("underwriter") or {}).get("id") == winning_underwriter.id,
                       f"the application's assigned underwriter matches whichever caller actually got 200 "
                       f"(expected {winning_underwriter.id}, got {(app_after_u.get('underwriter') or {}).get('id')})")
                record(app_after_u.get("status") != underwriter_ready_status,
                       f"status moved forward off '{underwriter_ready_status}' after the successful claim "
                       f"(got {app_after_u.get('status')})")
        else:
            skip("Could not determine a single winner (0 or 2 successes) for the underwriter race")

    cleanup_application(app_b_id, users.admin, doc_ids=doc_ids_b)

print_summary()
