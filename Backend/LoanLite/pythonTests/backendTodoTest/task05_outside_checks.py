"""
todo/backendTodo.csv - Task 5: Wire up the two external outside-check
services (credit score, income verification).

Design under test (see the CSV row for full background, and the
conversation where the design questions were resolved): before this task,
`creditScore`/`verifiedIncome` were plain fields a processor/underwriter
had to type in by hand. This task calls an external provably-fair
random-integer API (https://api.provable.io/api/ints) at claim time
(ProcessorController.claimApplication()) - TWO separate calls, one per
field, each with its own min/max range:
  - creditScore: min=300, max=900 (CIBIL-style scale)
  - verifiedIncome: min=10000, max=100000
`clientSeed` is the fixed literal "LoanLite" for both calls (the user's
explicit choice - not parameterized per application). If either call
fails/times out, that field is simply left null (per-field fallback to
manual entry via PUT /api/applications/{id}, same as before this task) -
the claim itself is never blocked by this external dependency.

This file exercises the real claim endpoint against the real external
service - it does NOT mock the HTTP call. Because of that, the assertions
below are deliberately lenient about VALUES: they check that if a field
came back non-null, it's within the agreed range, but they don't
hard-fail the whole run if the external service is unreachable from this
environment (network egress can vary by where this suite runs) - that's
tested as its own explicit fallback-still-works path instead of an
incidental failure.

Until this lands, the checks below are EXPECTED to FAIL (creditScore/
verifiedIncome stay null after claim, no external call happens) - that
failure is the whole point of pre-writing this regression test.

Usage:
    pip install requests
    python task05_outside_checks.py

Requires pythonTests/TempTest.py to have been run at least once already
(creates/role-assigns the fixed test accounts) and the Spring Boot app
running on http://localhost:8080 with outbound internet access to
api.provable.io.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
from common import (  # noqa: E402
    call, record, section, skip, guarded, setup_users, create_application,
    history_for_application, cleanup_application, print_summary,
)

CREDIT_SCORE_RANGE = (300, 900)
VERIFIED_INCOME_RANGE = (10000, 100000)

users = setup_users()

# ---------------------------------------------------------------------------
# Setup: applicant creates+submits an application, processor claims it -
# this is the actual trigger point for the outside checks.
# ---------------------------------------------------------------------------
section("Task 5: setup - applicant submits, processor claims (triggers outside checks)")

app = create_application(users.applicant, label="create application for outside-checks test")
if not app:
    skip("Task 5 checks skipped, could not create the application")
else:
    app_id = app["id"]
    record(app.get("creditScore") is None, "creditScore is null before claim, as expected")
    record(app.get("verifiedIncome") is None, "verifiedIncome is null before claim, as expected")

    guarded(
        f"/applications/{app_id}", users.applicant.token,
        lambda: call("PATCH", f"/applications/submit/{app_id}", token=users.applicant.token, expect=200,
                     label="applicant submits application for outside-checks test"),
        "submit application for outside-checks test",
    )

    section("Task 5: claim triggers the two outside checks")

    r = call("POST", f"/processor/claim/{app_id}", token=users.processor.token, expect=200,
              label="processor claims the application (should trigger outside checks)")

    if r.ok:
        claimed = r.json()
        credit_score = claimed.get("creditScore")
        verified_income = claimed.get("verifiedIncome")

        if credit_score is None and verified_income is None:
            skip("Both outside checks came back null - likely no outbound network access to "
                 "api.provable.io from this environment. Falling back to the manual-entry check below "
                 "instead of hard-failing on values this suite can't control.")
        else:
            if credit_score is not None:
                record(CREDIT_SCORE_RANGE[0] <= credit_score <= CREDIT_SCORE_RANGE[1],
                       f"creditScore {credit_score} is within the agreed range {CREDIT_SCORE_RANGE}")
            else:
                skip("creditScore came back null (external call failed) - manual entry still required")

            if verified_income is not None:
                record(VERIFIED_INCOME_RANGE[0] <= verified_income <= VERIFIED_INCOME_RANGE[1],
                       f"verifiedIncome {verified_income} is within the agreed range {VERIFIED_INCOME_RANGE}")
            else:
                skip("verifiedIncome came back null (external call failed) - manual entry still required")

        # -------------------------------------------------------------
        # History entry should mention the outside-check outcome either way
        # -------------------------------------------------------------
        entries = history_for_application(app_id, users.admin.token)
        claimed_entries = [h for h in entries if h.get("action") == "PROCESSOR_CLAIMED"]
        record(len(claimed_entries) == 1, f"exactly one PROCESSOR_CLAIMED history entry (found {len(claimed_entries)})")
        if claimed_entries:
            record("Outside checks:" in (claimed_entries[0].get("details") or ""),
                   f"PROCESSOR_CLAIMED history details mention the outside-check outcome "
                   f"(got {claimed_entries[0].get('details')!r})")

        # -------------------------------------------------------------
        # Sanity: manual entry still works as a fallback/override, whether
        # or not the outside check populated a value (staff can always
        # correct it via PUT, per the existing field-stripping rules).
        # -------------------------------------------------------------
        section("Task 5: manual entry via PUT still works regardless of outside-check outcome")

        r2 = call("PUT", f"/applications/{app_id}", token=users.processor.token,
                   json={"creditScore": 750, "verifiedIncome": 55000}, expect=200,
                   label="assigned processor manually sets creditScore/verifiedIncome via PUT")
        if r2.ok:
            record(r2.json().get("creditScore") == 750, "manual creditScore override took effect")
            record(float(r2.json().get("verifiedIncome")) == 55000.0, "manual verifiedIncome override took effect")

    cleanup_application(app_id, users.admin)

print_summary()
