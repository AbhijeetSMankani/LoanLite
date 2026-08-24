"""
Follow-up (2026-08-24, user-raised directly, not a backendTodo.csv row -
that backlog was already fully Done): improve verifyApplication()'s
recommendation to account for debt-to-income.

Design under test (see the conversation where the three open questions
were resolved):
  - There's no existing-debt field anywhere in this data model, so the
    practical metric is this loan's own EMI as a fraction of income (an
    EMI-to-income ratio), not a true multi-debt DTI.
  - Divides by declaredIncome, NOT verifiedIncome - verifiedIncome comes
    from a random-number outside check (backendTodo.csv task 5), not a
    meaningful affordability signal, per the user's explicit call.
  - A ratio > 50% (ProcessorController.EMI_TO_INCOME_DOWNGRADE_THRESHOLD)
    independently downgrades whatever tier the credit-score-based logic
    already produced by exactly one step: APPROVE -> MANUAL_REVIEW,
    MANUAL_REVIEW -> REJECT. REJECT can't downgrade further. This can
    override even a strong credit score (creditScore >= 700).
  - recommendationReason gets an appended explanation with the actual
    EMI/declaredIncome rupee figures in Indian digit grouping
    (e.g. "₹1,66,667"), not Western grouping, per the user's explicit ask.

Until this lands, every "downgraded" check below is EXPECTED to FAIL
(recommendation stays at the credit-score-only tier) - that failure is
the whole point of pre-writing this regression test.

Usage:
    pip install requests
    python task09_dti_recommendation_downgrade.py

Requires pythonTests/TempTest.py to have been run at least once already
(creates/role-assigns the fixed test accounts) and the Spring Boot app
running on http://localhost:8080.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
from common import (  # noqa: E402
    call, record, section, skip, guarded, setup_users, upload_all_required_documents,
    cleanup_application, print_summary,
)

users = setup_users()


def drive_to_verified(loan_amount, tenure_months, declared_income, credit_score, label, verified_income=50000):
    """Creates+submits+claims+verifies-all-docs an application with the given financials, sets
    creditScore/verifiedIncome manually (bypassing the random outside check - task 5's live
    random.org call would otherwise make the APPROVE-tier verifiedIncome>=30000 gate
    non-deterministic) for a deterministic test, then calls verify(). Returns the verify()
    response and the list of created document ids."""
    r = call("POST", "/applications", token=users.applicant.token,
              json={"applicant": {"id": users.applicant.id}, "loanAmount": loan_amount,
                    "tenureMonths": tenure_months, "declaredIncome": declared_income},
              expect=201, label=f"create application for {label}")
    if not r.ok:
        return None, []
    app_id = r.json()["id"]
    doc_ids = upload_all_required_documents(app_id, users.applicant.token)

    guarded(f"/applications/{app_id}", users.applicant.token,
            lambda: call("PATCH", f"/applications/submit/{app_id}", token=users.applicant.token, expect=200,
                         label=f"submit application for {label}"),
            f"submit for {label}")
    guarded(f"/applications/{app_id}", users.admin.token,
            lambda: call("POST", f"/processor/claim/{app_id}", token=users.processor.token, expect=200,
                         label=f"processor claims application for {label}"),
            f"claim for {label}")
    for doc_id in doc_ids:
        guarded(f"/documents/{doc_id}", users.processor.token,
                lambda doc_id=doc_id: call("PATCH", f"/documents/{doc_id}", token=users.processor.token,
                                             json={"verificationStatus": "VERIFIED"}, expect=200,
                                             label=f"verify document {doc_id} for {label}"),
                f"verify doc {doc_id} for {label}")
    # Force deterministic creditScore/verifiedIncome, overriding whatever the random outside
    # check set at claim time - this test is about the DTI downgrade, not the credit-score/
    # verified-income tiering itself.
    guarded(f"/applications/{app_id}", users.admin.token,
            lambda: call("PUT", f"/applications/{app_id}", token=users.processor.token,
                         json={"creditScore": credit_score, "verifiedIncome": verified_income}, expect=200,
                         label=f"set deterministic creditScore={credit_score}/verifiedIncome={verified_income} for {label}"),
            f"set creditScore/verifiedIncome for {label}")

    r2 = call("POST", f"/processor/applications/{app_id}/verify", token=users.processor.token, expect=200,
               label=f"processor verifies application for {label}")
    return (r2, doc_ids) if r2.ok else (None, doc_ids)


# ---------------------------------------------------------------------------
# A strong applicant (creditScore=800, would normally be APPROVE) but with
# an unaffordable EMI relative to declaredIncome (loanAmount so large the
# EMI is well over 50% of a small declared income) - should downgrade
# APPROVE -> MANUAL_REVIEW.
# ---------------------------------------------------------------------------
section("Task 9: a high EMI-to-income ratio downgrades APPROVE to MANUAL_REVIEW")

r, doc_ids_a = drive_to_verified(loan_amount=2000000, tenure_months=12, declared_income=15000,
                                   credit_score=800, label="high-DTI strong-credit case")
if r:
    body = r.json()
    record(body.get("recommendation") == "MANUAL_REVIEW",
           f"recommendation downgraded from APPROVE to MANUAL_REVIEW (got {body.get('recommendation')!r})")
    reason = body.get("recommendationReason") or ""
    record("Downgraded from APPROVE" in reason, f"reason mentions the downgrade (got {reason!r})")
    record("₹" in reason, f"reason uses the ₹ symbol (got {reason!r})")
    record("," in reason, f"reason includes a comma-grouped rupee figure (got {reason!r})")
    app_id_a = body.get("id")
else:
    skip("High-DTI strong-credit case skipped")
    app_id_a = None

# ---------------------------------------------------------------------------
# A borderline applicant (creditScore=650, would normally be MANUAL_REVIEW)
# with a high EMI-to-income ratio - should downgrade further to REJECT.
# ---------------------------------------------------------------------------
section("Task 9: a high EMI-to-income ratio downgrades MANUAL_REVIEW to REJECT")

r2, doc_ids_b = drive_to_verified(loan_amount=2000000, tenure_months=12, declared_income=15000,
                                    credit_score=650, label="high-DTI borderline-credit case")
if r2:
    body2 = r2.json()
    record(body2.get("recommendation") == "REJECT",
           f"recommendation downgraded from MANUAL_REVIEW to REJECT (got {body2.get('recommendation')!r})")
    record("Downgraded from MANUAL_REVIEW" in (body2.get("recommendationReason") or ""),
           "reason mentions the downgrade")
else:
    skip("High-DTI borderline-credit case skipped")

# ---------------------------------------------------------------------------
# Sanity: a healthy EMI-to-income ratio does NOT downgrade a strong
# applicant - no false positives.
# ---------------------------------------------------------------------------
section("Task 9: a healthy EMI-to-income ratio does not downgrade APPROVE")

r3, doc_ids_c = drive_to_verified(loan_amount=100000, tenure_months=60, declared_income=100000,
                                    credit_score=800, label="healthy-DTI strong-credit case")
if r3:
    body3 = r3.json()
    record(body3.get("recommendation") == "APPROVE",
           f"recommendation stays APPROVE with a healthy ratio (got {body3.get('recommendation')!r})")
    record("Downgraded" not in (body3.get("recommendationReason") or ""),
           "reason does not mention a downgrade")
else:
    skip("Healthy-DTI strong-credit case skipped")

# ---------------------------------------------------------------------------
# Sanity: REJECT can't be downgraded further (already the floor).
# ---------------------------------------------------------------------------
section("Task 9: an already-REJECT recommendation is not further annotated")

r4, doc_ids_d = drive_to_verified(loan_amount=2000000, tenure_months=12, declared_income=15000,
                                    credit_score=500, label="high-DTI weak-credit case")
if r4:
    body4 = r4.json()
    record(body4.get("recommendation") == "REJECT",
           f"recommendation is REJECT regardless of the ratio (got {body4.get('recommendation')!r})")
    record("Downgraded" not in (body4.get("recommendationReason") or ""),
           "reason does not claim a 'downgrade' when it was already REJECT")
else:
    skip("High-DTI weak-credit case skipped")

# Cleanup
if app_id_a:
    cleanup_application(app_id_a, users.admin, doc_ids=doc_ids_a)
if r2:
    cleanup_application(r2.json()["id"], users.admin, doc_ids=doc_ids_b)
if r3:
    cleanup_application(r3.json()["id"], users.admin, doc_ids=doc_ids_c)
if r4:
    cleanup_application(r4.json()["id"], users.admin, doc_ids=doc_ids_d)

print_summary()
