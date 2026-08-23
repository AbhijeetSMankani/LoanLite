"""
todo/backendTodo.csv - Task 2: Force/strip createdAt, updatedAt, submittedAt
on LoanApplicationController.create() (POST /api/applications).

Design under test (see the CSV row for full background): create() already
force-overwrites status/recommendation/decision/processor/underwriter/
creditScore/verifiedIncome/interestRate regardless of caller input, but
createdAt/updatedAt/submittedAt did not get the same treatment - a caller
could send an arbitrary (e.g. backdated) createdAt/updatedAt, and an
arbitrary submittedAt, and have it persisted as-is.

The fix: LoanApplicationController.create() now force-nulls all three
fields on the incoming body before calling the service, so
createdAt/updatedAt always come out as "now" (via
LoanApplicationService.createApplication()'s existing null-check-then-now()
logic) and submittedAt always comes out null regardless of what's sent.

Until this lands, the checks below are EXPECTED to FAIL (today a
caller-supplied createdAt/submittedAt is persisted as sent) - that failure
is the whole point of pre-writing this regression test.

Usage:
    pip install requests
    python task02_force_timestamps_on_create.py

Requires pythonTests/TempTest.py to have been run at least once already
(creates/role-assigns the fixed test accounts) and the Spring Boot app
running on http://localhost:8080.
"""

import sys
import os
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(__file__))
from common import (  # noqa: E402
    call, record, section, setup_users, cleanup_application, print_summary,
)

users = setup_users()

# ---------------------------------------------------------------------------
# A backdated createdAt/updatedAt, plus a pre-populated submittedAt, sent
# directly in the create body.
# ---------------------------------------------------------------------------
section("Task 2: create() ignores caller-supplied createdAt/updatedAt/submittedAt")

backdated = (datetime.now() - timedelta(days=365)).isoformat(timespec="milliseconds")
future_submitted = (datetime.now() + timedelta(days=1)).isoformat(timespec="milliseconds")

r = call(
    "POST", "/applications", token=users.applicant.token,
    json={
        "applicant": {"id": users.applicant.id},
        "loanAmount": 150000,
        "tenureMonths": 24,
        "declaredIncome": 40000,
        "createdAt": backdated,
        "updatedAt": backdated,
        "submittedAt": future_submitted,
    },
    expect=201,
    label="applicant creates an application with a backdated createdAt/updatedAt and a set submittedAt",
)

app = r.json() if r.ok else None
if not app:
    record(False, "Task 2 checks skipped, could not create the application")
else:
    app_id = app["id"]
    now = datetime.now()

    created_at = app.get("createdAt")
    updated_at = app.get("updatedAt")
    submitted_at = app.get("submittedAt")

    def is_recent(iso_str):
        if not iso_str:
            return False
        try:
            parsed = datetime.fromisoformat(iso_str)
        except ValueError:
            return False
        return abs((now - parsed).total_seconds()) < 60

    record(is_recent(created_at),
           f"createdAt was forced to ~now, not the backdated value sent (got {created_at!r})")
    record(is_recent(updated_at),
           f"updatedAt was forced to ~now, not the backdated value sent (got {updated_at!r})")
    record(submitted_at is None,
           f"submittedAt was forced to null on create, not the future value sent (got {submitted_at!r})")

    # -----------------------------------------------------------------
    # Sanity: submit still sets submittedAt for real, afterward
    # -----------------------------------------------------------------
    section("Task 2: submittedAt still gets set for real by the submit action")

    r = call("PATCH", f"/applications/submit/{app_id}", token=users.applicant.token, expect=200,
             label="applicant submits the application")
    if r.ok:
        record(r.json().get("submittedAt") is not None,
               "submittedAt is now set after a real submit action")

    cleanup_application(app_id, users.admin)

print_summary()
