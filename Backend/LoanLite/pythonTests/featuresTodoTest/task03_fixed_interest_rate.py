"""
todo/featuresTodo.csv - Task 3: Fix the loan interest rate to a single
backend-defined value instead of an arbitrary per-application field.

Design under test (see the CSV row for full background): LoanApplication.
interestRate is currently a pure passthrough - LoanApplicationService.
updateApplication() does `if (app.getInterestRate() != null)
existing.setInterestRate(app.getInterestRate());`, and
LoanApplicationController.create() never touches interestRate at all -
meaning any caller with write access can set it to whatever they send. This
task defines a backend constant for the one fixed rate the project's
external "Problem Statement" spec calls for, and makes create()/update()
force interestRate to that constant regardless of what the caller sends -
the same way create() already force-nulls creditScore, recommendation,
decision, processor, underwriter, etc.

IMPORTANT - why this file has no hardcoded expected numeric value:
the exact fixed-rate number comes from an external spec document this repo
does not have access to, so guessing a number here would just be another
made-up value, no better than the "arbitrary per-application" bug this task
fixes. Instead, FIXED_RATE is discovered dynamically at test-run time: the
first application created below (deliberately without an interestRate in
the body) returns whatever the backend assigns, and that value is treated
as FIXED_RATE for the rest of THIS run - captured as a local variable, not
a module-level constant. Every other check in this file just confirms that
value stays constant across applications and across caller-supplied
overrides, never that it equals any specific number.

Until Task 3 lands, interestRate is still a plain passthrough field, so the
very first check (freshly created application has a non-null,
backend-assigned interestRate) is expected to reveal whether the fix has
landed - if create() doesn't force it yet, POST without interestRate will
likely come back with a null value and everything downstream is skipped,
same guarded()-cascade-avoidance pattern task01 uses.

Usage:
    pip install requests
    python task03_fixed_interest_rate.py

Requires pythonTests/TempTest.py to have been run at least once already
(creates/role-assigns the fixed test accounts) and the Spring Boot app
running on http://localhost:8080.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
from common import (  # noqa: E402
    call, record, section, skip, guarded, setup_users, create_application,
    cleanup_application, print_summary,
)

# Deliberately NOT a hardcoded numeric guess - see module docstring. Sanity
# bounds only, to catch a nonsensical value (e.g. 0, negative, or a percent
# expressed as a raw fraction like 0.085) without pinning an exact number.
SANE_RATE_MIN = 0
SANE_RATE_MAX = 50

# Caller-supplied values every check below tries to sneak past the backend.
OVERRIDE_RATE_ON_CREATE = 99.99
OVERRIDE_RATE_ON_DRAFT_UPDATE = 5.0
OVERRIDE_RATE_ON_STAFF_UPDATE = 12.34

users = setup_users()
created_app_ids = []  # tracked for best-effort cleanup at the end


def rates_match(a, b):
    """Compares interestRate values as floats - BigDecimal may serialize as
    e.g. 7.5 vs 7.50, this treats those as equal."""
    if a is None or b is None:
        return False
    try:
        return abs(float(a) - float(b)) < 1e-9
    except (TypeError, ValueError):
        return False


# ---------------------------------------------------------------------------
# Unauthenticated create is still rejected (quick regression check, already
# covered elsewhere but kept here so this file stands alone per task01's
# convention of a full set of checks)
# ---------------------------------------------------------------------------
section("Regression: unauthenticated create is still rejected")

call("POST", "/applications", token=None,
     json={"applicant": {"id": users.applicant.id}, "loanAmount": 200000,
           "tenureMonths": 24, "declaredIncome": 45000},
     expect=401, label="unauthenticated create attempt (should be rejected)")

# ---------------------------------------------------------------------------
# Create without interestRate -> backend assigns a non-null fixed rate.
# This value becomes FIXED_RATE for the rest of this run.
# ---------------------------------------------------------------------------
section("Task 3: create without interestRate gets a backend-assigned fixed rate")

FIXED_RATE = None

app1 = create_application(users.applicant, label="create application without interestRate in the body")
if not app1:
    skip("Fixed-rate discovery skipped, could not create the first application")
else:
    created_app_ids.append(app1["id"])
    rate1 = app1.get("interestRate")
    if record(rate1 is not None,
              "created application has a non-null interestRate (backend-assigned fixed rate)"):
        FIXED_RATE = rate1
        record(SANE_RATE_MIN < float(FIXED_RATE) < SANE_RATE_MAX,
               f"discovered FIXED_RATE ({FIXED_RATE}) is a sane loan interest rate "
               f"(sanity bound {SANE_RATE_MIN}-{SANE_RATE_MAX}, not a precise value check)")

if FIXED_RATE is None:
    skip("Remaining Task 3 checks skipped, no FIXED_RATE could be discovered "
         "(interestRate came back null - the fix likely hasn't landed yet)")
else:
    # -----------------------------------------------------------------------
    # Create with an explicit, different interestRate -> caller value ignored
    # -----------------------------------------------------------------------
    section("Task 3: create ignores a caller-supplied interestRate")

    app2 = create_application(users.applicant, interestRate=OVERRIDE_RATE_ON_CREATE,
                               label=f"create application explicitly sending interestRate={OVERRIDE_RATE_ON_CREATE}")
    if not app2:
        skip("Create-override check skipped, could not create the second application")
    else:
        created_app_ids.append(app2["id"])
        rate2 = app2.get("interestRate")
        record(rates_match(rate2, FIXED_RATE),
               f"create() forced interestRate to FIXED_RATE ({FIXED_RATE}), ignoring the "
               f"caller-supplied {OVERRIDE_RATE_ON_CREATE} (got {rate2})")
        record(not rates_match(rate2, OVERRIDE_RATE_ON_CREATE),
               f"the caller-supplied override ({OVERRIDE_RATE_ON_CREATE}) was NOT persisted")

    # -----------------------------------------------------------------------
    # A third, independently created application gets the same fixed rate
    # -----------------------------------------------------------------------
    section("Task 3: the fixed rate is the same across independent applications")

    app3 = create_application(users.applicant, label="create a third, independent application")
    if not app3:
        skip("Cross-application consistency check skipped, could not create the third application")
    else:
        created_app_ids.append(app3["id"])
        rate3 = app3.get("interestRate")
        record(rates_match(rate3, FIXED_RATE),
               f"third application's interestRate ({rate3}) equals FIXED_RATE ({FIXED_RATE}) - "
               "same fixed value across applications, not per-application variance")

    # -----------------------------------------------------------------------
    # Owning applicant updates a Draft application, trying to override the
    # rate -> update() also ignores the caller-supplied value
    # -----------------------------------------------------------------------
    section("Task 3: owning applicant's Draft update ignores a caller-supplied interestRate")

    if not app1:
        skip("Draft-update override check skipped, no Draft application available")
    else:
        draft_app_id = app1["id"]

        def do_draft_update():
            r = call("PUT", f"/applications/{draft_app_id}", token=users.applicant.token,
                     json={"interestRate": OVERRIDE_RATE_ON_DRAFT_UPDATE}, expect=200,
                     label=f"owning applicant PUTs interestRate={OVERRIDE_RATE_ON_DRAFT_UPDATE} "
                           "on their own Draft application")
            if r.ok:
                record(rates_match(r.json().get("interestRate"), FIXED_RATE),
                       f"applicant's Draft PUT still returns FIXED_RATE ({FIXED_RATE}), ignoring "
                       f"the caller-supplied {OVERRIDE_RATE_ON_DRAFT_UPDATE} (got {r.json().get('interestRate')})")

        guarded(
            f"/applications/{draft_app_id}", users.applicant.token,
            do_draft_update,
            "owning applicant Draft update with interestRate override",
        )

    # -----------------------------------------------------------------------
    # Staff (processor) claims the application, then also tries to override
    # the rate on update -> still forced to FIXED_RATE
    # -----------------------------------------------------------------------
    section("Task 3: staff update ignores a caller-supplied interestRate")

    staff_app = create_application(users.applicant, label="create application for the staff-update check")
    if not staff_app:
        skip("Staff-update override check skipped, could not create the application")
    else:
        staff_app_id = staff_app["id"]
        created_app_ids.append(staff_app_id)

        guarded(
            f"/applications/{staff_app_id}", users.applicant.token,
            lambda: call("PATCH", f"/applications/submit/{staff_app_id}", token=users.applicant.token, expect=200,
                         label="applicant submits application for the staff-update check"),
            "submit application for the staff-update check",
        )
        guarded(
            f"/applications/{staff_app_id}", users.admin.token,
            lambda: call("POST", f"/processor/claim/{staff_app_id}", token=users.processor.token, expect=200,
                         label="processor claims the application"),
            "processor claims the application",
        )

        def do_staff_update():
            r = call("PUT", f"/applications/{staff_app_id}", token=users.processor.token,
                     json={"interestRate": OVERRIDE_RATE_ON_STAFF_UPDATE}, expect=200,
                     label=f"processor PUTs interestRate={OVERRIDE_RATE_ON_STAFF_UPDATE} after claiming")
            if r.ok:
                record(rates_match(r.json().get("interestRate"), FIXED_RATE),
                       f"processor's update still returns FIXED_RATE ({FIXED_RATE}), ignoring "
                       f"the caller-supplied {OVERRIDE_RATE_ON_STAFF_UPDATE} (got {r.json().get('interestRate')})")

        guarded(
            f"/applications/{staff_app_id}", users.admin.token,
            do_staff_update,
            "processor update with interestRate override after claiming",
        )

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------
section("Cleanup")

for app_id in created_app_ids:
    cleanup_application(app_id, users.admin)

print_summary()
