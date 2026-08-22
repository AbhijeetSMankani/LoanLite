"""
todo/featuresTodo.csv - Task 4: Calculate and populate EMI in the backend
instead of leaving it an unused passthrough field.

Design under test (see the CSV row for full background): LoanApplication.emi
(entities/LoanApplication.java, BigDecimal) is currently just persisted
as-is by LoanApplicationService.updateApplication() - there is no computation
logic anywhere. This task implements the standard EMI formula:

    EMI = [P x R x (1+R)^N] / [(1+R)^N - 1]

    P = loanAmount
    N = tenureMonths
    R = the fixed MONTHLY interest rate, i.e. the fixed ANNUAL rate from
        Task 3 divided by 12 and by 100 (percent -> monthly decimal rate)

This should run as backend logic on create, and on update while the
application is still editable, and should always overwrite any
caller-supplied emi value with the computed one - same pattern as
interestRate in Task 3 (see task03_fixed_interest_rate.py, which this test
depends on for the "don't hardcode the rate, discover it dynamically at
test-run time" approach).

This task explicitly DEPENDS on Task 3 landing first (a fixed, trustworthy
interestRate is a precondition for computing a meaningful emi). Until Task 3
computes and returns a real interestRate, the interestRate this test reads
back off a create() response may itself be null/wrong, and every emi check
below will fail or error accordingly - that's expected and is exactly what
should turn green once both tasks are done.

Out of scope (per the CSV discussion, a separate low-priority bean-validation
task): zero/missing tenureMonths or loanAmount. Not tested here.

Usage:
    pip install requests
    python task04_emi_calculation.py

Requires pythonTests/TempTest.py to have been run at least once already
(creates/role-assigns the fixed test accounts) and the Spring Boot app
running on http://localhost:8080.
"""

import sys
import os
from decimal import Decimal

sys.path.insert(0, os.path.dirname(__file__))
from common import (  # noqa: E402
    call, record, section, skip, guarded, setup_users, create_application,
    cleanup_application, print_summary,
)

# Allowed absolute difference between the actual emi from the API and the
# expected value computed independently in Python - a tolerance rather than
# an exact match because the backend's BigDecimal rounding/scale convention
# (e.g. HALF_UP to 2 decimal places vs. some other scheme) is unknown ahead
# of implementation.
EMI_TOLERANCE = 1.0

users = setup_users()


def expected_emi(principal, tenure_months, annual_rate_percent):
    """Standard reducing-balance EMI formula:

        EMI = [P x R x (1+R)^N] / [(1+R)^N - 1]

    where P = principal, N = tenure_months, and R is the MONTHLY interest
    rate expressed as a decimal (annual_rate_percent / 12 / 100). Returns a
    float; callers should compare against the API's emi with a numeric
    tolerance rather than exact equality.
    """
    p = Decimal(str(principal))
    n = int(tenure_months)
    r = Decimal(str(annual_rate_percent)) / Decimal(12) / Decimal(100)

    if r == 0:
        # Degenerate case, not expected in practice given a real fixed rate,
        # but avoids a division-by-zero if annual_rate_percent is ever 0.
        return float(p / n)

    one_plus_r_to_n = (Decimal(1) + r) ** n
    numerator = p * r * one_plus_r_to_n
    denominator = one_plus_r_to_n - Decimal(1)
    return float(numerator / denominator)


def close(actual, expected, tolerance=EMI_TOLERANCE):
    if actual is None:
        return False
    return abs(float(actual) - float(expected)) < tolerance


# ---------------------------------------------------------------------------
# Unauthenticated create -> 401 (kept self-contained per task01's convention)
# ---------------------------------------------------------------------------
section("Task 4: unauthenticated access is rejected")

call("POST", "/applications", token=None,
     json={"applicant": {"id": users.applicant.id}, "loanAmount": 500000, "tenureMonths": 24},
     expect=401, label="unauthenticated create is rejected")

# ---------------------------------------------------------------------------
# Create with no emi field -> backend computes it from loanAmount/tenureMonths
# and the fixed interestRate
# ---------------------------------------------------------------------------
section("Task 4: emi is computed on create from loanAmount, tenureMonths, and the fixed interestRate")

app = create_application(users.applicant, loanAmount=500000, tenureMonths=24,
                          label="create application with loanAmount=500000, tenureMonths=24, no emi field")
if not app:
    skip("Create-time emi checks skipped, could not create the application")
else:
    app_id = app["id"]
    rate = app.get("interestRate")
    emi = app.get("emi")

    if record(rate is not None, "created application has a non-null interestRate (Task 3 precondition)"):
        expected = expected_emi(500000, 24, rate)
        if record(emi is not None, "created application has a non-null emi"):
            record(close(emi, expected),
                   f"emi matches the formula's expected value for loanAmount=500000, tenureMonths=24, "
                   f"rate={rate} (expected ~{expected:.2f}, got {emi})")
    else:
        skip("emi-vs-formula check skipped, interestRate was null (Task 3 not landed yet?)")

    cleanup_application(app_id, users.admin)

# ---------------------------------------------------------------------------
# Caller-supplied emi is ignored and overwritten with the computed value
# ---------------------------------------------------------------------------
section("Task 4: a caller-supplied emi value is ignored on create")

bogus_app = create_application(users.applicant, loanAmount=500000, tenureMonths=24, emi=1,
                                label="create application explicitly sending a bogus emi=1")
if not bogus_app:
    skip("Bogus-emi-on-create check skipped, could not create the application")
else:
    bogus_app_id = bogus_app["id"]
    rate = bogus_app.get("interestRate")
    emi = bogus_app.get("emi")

    record(emi != 1, f"caller-supplied emi=1 was not persisted as-is (got {emi})")
    if rate is not None:
        expected = expected_emi(500000, 24, rate)
        record(close(emi, expected),
               f"emi was instead computed correctly from the formula (expected ~{expected:.2f}, got {emi})")
    else:
        skip("bogus-emi formula check skipped, interestRate was null (Task 3 not landed yet?)")

    cleanup_application(bogus_app_id, users.admin)

# ---------------------------------------------------------------------------
# Updating loanAmount/tenureMonths while Draft recomputes emi, not stale
# ---------------------------------------------------------------------------
section("Task 4: updating loanAmount or tenureMonths while Draft recomputes emi")

upd_app = create_application(users.applicant, loanAmount=500000, tenureMonths=24,
                              label="create application for the update-recomputes-emi check")
if not upd_app:
    skip("Update-recomputes-emi check skipped, could not create the application")
else:
    upd_app_id = upd_app["id"]
    original_emi = upd_app.get("emi")

    new_loan_amount = 800000
    updated_app = None

    def do_update():
        global updated_app
        r = call("PUT", f"/applications/{upd_app_id}", token=users.applicant.token,
                 json={"loanAmount": new_loan_amount}, expect=200,
                 label=f"applicant updates loanAmount to {new_loan_amount} while Draft")
        if r.ok:
            updated_app = r.json()

    guarded(f"/applications/{upd_app_id}", users.applicant.token, do_update,
            f"update loanAmount for application {upd_app_id}")

    if updated_app is None:
        skip("Post-update emi checks skipped, the update call did not return a body")
    else:
        new_rate = updated_app.get("interestRate")
        new_emi = updated_app.get("emi")

        record(updated_app.get("loanAmount") in (new_loan_amount, float(new_loan_amount)),
               f"application reflects the new loanAmount ({new_loan_amount}), got {updated_app.get('loanAmount')}")
        record(new_emi != original_emi,
               f"emi was recomputed after the loanAmount change, not left stale at the original value "
               f"(original={original_emi}, new={new_emi})")

        if new_rate is not None:
            expected_new = expected_emi(new_loan_amount, 24, new_rate)
            record(close(new_emi, expected_new),
                   f"recomputed emi matches the formula for the new loanAmount={new_loan_amount} "
                   f"(expected ~{expected_new:.2f}, got {new_emi})")
        else:
            skip("recomputed-emi formula check skipped, interestRate was null (Task 3 not landed yet?)")

    cleanup_application(upd_app_id, users.admin)

print_summary()
