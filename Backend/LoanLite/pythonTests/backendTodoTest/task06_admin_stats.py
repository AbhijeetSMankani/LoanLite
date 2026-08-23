"""
todo/backendTodo.csv - Task 6: Add an admin analytics/counts endpoint.

Design under test (see the CSV row and the conversation where the shape
was agreed): a new GET /api/admin/stats, ADMIN-only, returning:
  {
    totalApplications: number,
    byStatus: { <status>: number, ... },
    createdThisMonth: number,
    approvedThisMonth: number,
    rejectedThisMonth: number
  }
approvedThisMonth/rejectedThisMonth use updatedAt as an approximate
decision timestamp (there's no dedicated decidedAt field) - accurate in
practice since Accepted/Rejected are terminal states.

This file checks: access control (ADMIN only), the response shape, that
totalApplications equals the sum of byStatus values, and that creating+
deciding a fresh application during the test run moves the relevant
counters by exactly 1 (a before/after diff, since the real database
already has other applications in it from prior test runs - this doesn't
assert absolute counts).

Until this lands, every check below is EXPECTED to FAIL (404 - the
endpoint doesn't exist yet) - that failure is the whole point of
pre-writing this regression test.

Usage:
    pip install requests
    python task06_admin_stats.py

Requires pythonTests/TempTest.py to have been run at least once already
(creates/role-assigns the fixed test accounts) and the Spring Boot app
running on http://localhost:8080.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
from common import (  # noqa: E402
    call, record, section, skip, guarded, setup_users, create_application,
    upload_all_required_documents, cleanup_application, print_summary,
)

users = setup_users()

# ---------------------------------------------------------------------------
# Access control
# ---------------------------------------------------------------------------
section("Task 6: access control")

call("GET", "/admin/stats", expect=401, label="unauthenticated GETs stats (should be unauthorized)")

for role_label, user in (("applicant", users.applicant), ("processor", users.processor),
                          ("underwriter", users.underwriter)):
    call("GET", "/admin/stats", token=user.token, expect=403,
         label=f"{role_label} GETs stats (should be forbidden, ADMIN only)")

# ---------------------------------------------------------------------------
# Response shape, and a before/after diff across a real application's
# lifecycle (create -> submit -> claim -> verify -> underwriter accept).
# ---------------------------------------------------------------------------
section("Task 6: response shape")

r = call("GET", "/admin/stats", token=users.admin.token, expect=200, label="admin GETs stats")
before = r.json() if r.ok else None

if before:
    record("totalApplications" in before, "response has totalApplications")
    record("byStatus" in before and isinstance(before["byStatus"], dict), "response has a byStatus object")
    record("createdThisMonth" in before, "response has createdThisMonth")
    record("approvedThisMonth" in before, "response has approvedThisMonth")
    record("rejectedThisMonth" in before, "response has rejectedThisMonth")

    if "byStatus" in before:
        record(before["totalApplications"] == sum(before["byStatus"].values()),
               f"totalApplications ({before['totalApplications']}) equals the sum of byStatus "
               f"values ({sum(before['byStatus'].values())})")

section("Task 6: creating an application increments createdThisMonth and byStatus.Draft by 1")

app = create_application(users.applicant, label="create application for admin-stats diff check")
if not app:
    skip("Task 6 diff checks skipped, could not create the application")
else:
    app_id = app["id"]
    doc_ids = upload_all_required_documents(app_id, users.applicant.token)

    r = call("GET", "/admin/stats", token=users.admin.token, expect=200,
              label="admin GETs stats after creating a Draft application")
    if r.ok and before:
        after = r.json()
        record(after["createdThisMonth"] == before["createdThisMonth"] + 1,
               f"createdThisMonth went from {before['createdThisMonth']} to {after['createdThisMonth']}")
        record(after["byStatus"].get("Draft", 0) == before["byStatus"].get("Draft", 0) + 1,
               f"byStatus.Draft went from {before['byStatus'].get('Draft', 0)} to {after['byStatus'].get('Draft', 0)}")
        before = after

    section("Task 6: an accepted application increments approvedThisMonth and byStatus.Accepted by 1")

    guarded(
        f"/applications/{app_id}", users.applicant.token,
        lambda: call("PATCH", f"/applications/submit/{app_id}", token=users.applicant.token, expect=200,
                     label="applicant submits application for admin-stats diff check"),
        "submit application for admin-stats diff check",
    )
    guarded(
        f"/applications/{app_id}", users.admin.token,
        lambda: call("POST", f"/processor/claim/{app_id}", token=users.processor.token, expect=200,
                     label="processor claims the application"),
        "processor claims the application",
    )
    for doc_id in doc_ids:
        guarded(
            f"/documents/{doc_id}", users.processor.token,
            lambda doc_id=doc_id: call("PATCH", f"/documents/{doc_id}", token=users.processor.token,
                                         json={"verificationStatus": "VERIFIED"}, expect=200,
                                         label=f"processor verifies document {doc_id}"),
            f"verify document {doc_id}",
        )
    guarded(
        f"/applications/{app_id}", users.admin.token,
        lambda: call("PUT", f"/applications/{app_id}", token=users.processor.token,
                     json={"creditScore": 800, "verifiedIncome": 60000}, expect=200,
                     label="processor sets a strong credit profile to guarantee an APPROVE recommendation"),
        "set credit profile for admin-stats diff check",
    )
    guarded(
        f"/applications/{app_id}", users.admin.token,
        lambda: call("POST", f"/processor/applications/{app_id}/verify", token=users.processor.token, expect=200,
                     label="processor verifies the application (-> Verified)"),
        "processor verifies the application",
    )
    guarded(
        f"/applications/{app_id}", users.admin.token,
        lambda: call("POST", f"/underwriter/claim/{app_id}", token=users.underwriter.token, expect=200,
                     label="underwriter claims the application (-> Under Review)"),
        "underwriter claims the application",
    )
    guarded(
        f"/applications/{app_id}", users.admin.token,
        lambda: call("POST", f"/underwriter/applications/{app_id}/decision", token=users.underwriter.token,
                     json={"decision": "ACCEPTED"}, expect=200,
                     label="underwriter accepts the application"),
        "underwriter accepts the application",
    )

    r = call("GET", "/admin/stats", token=users.admin.token, expect=200,
              label="admin GETs stats after the application is Accepted")
    if r.ok and before:
        after = r.json()
        record(after["approvedThisMonth"] == before["approvedThisMonth"] + 1,
               f"approvedThisMonth went from {before['approvedThisMonth']} to {after['approvedThisMonth']}")
        record(after["byStatus"].get("Accepted", 0) == before["byStatus"].get("Accepted", 0) + 1,
               f"byStatus.Accepted went from {before['byStatus'].get('Accepted', 0)} to {after['byStatus'].get('Accepted', 0)}")
        record(after["byStatus"].get("Draft", 0) == before["byStatus"].get("Draft", 0) - 1,
               f"byStatus.Draft went from {before['byStatus'].get('Draft', 0)} to {after['byStatus'].get('Draft', 0)} "
               f"(the application moved out of Draft)")

    cleanup_application(app_id, users.admin, doc_ids=doc_ids)

print_summary()
