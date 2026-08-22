"""
todo/featuresTodo.csv - Task 2: Add an admin-only role-assignment endpoint in
AdminController.java.

Design under test (see the CSV row for full background): today the only ways
to change a user's role are (a) a direct manual SQL UPDATE, or (b) the
generic PUT /api/users/{id} full-entity update in UserController.java, whose
only safeguard is that a caller cannot change their OWN role (an existing
IllegalArgumentException("You cannot change your own role") in
UserController.update(), mapped by GlobalExceptionHandler to 400). This task
adds a new, dedicated, minimal endpoint: a new controllers/AdminController.java
with a PATCH action that accepts only {"role": "..."}, validates it against
the known role set (ROLE_USER, ROLE_PROCESSOR, ROLE_UNDERWRITER, ROLE_ADMIN),
updates only the role field via UserService (not the whole entity), is
ADMIN-only, and carries over the same self-role-change block as
UserController.update() so an admin can't use this new endpoint on themself
either.

The CSV row only says "an endpoint such as PATCH /api/admin/users/{id}/role"
and "a small body like {"role": "ROLE_PROCESSOR"}" - both marked "e.g." in
the source material, i.e. NOT confirmed. The constants below are this test's
ASSUMPTIONS; if the real implementation lands with a different path, HTTP
method, or body key, update ROLE_ENDPOINT/ROLE_BODY_KEY here rather than
rewriting the checks - the density and intent of the checks (admin-only,
minimal field-scoped update, self-role-change still blocked, invalid role
rejected, ...) holds regardless of the exact wire shape.

Assumed status codes (also unconfirmed - GlobalExceptionHandler's existing
patterns are the best evidence available): a successful role change ->
200 OK (a PATCH updating an existing resource, matching
DocumentController.updateDocumentStatus()'s 200 elsewhere in this codebase);
an invalid/unknown role string, and a missing/blank role field -> 400
(matching the IllegalArgumentException -> 400 pattern used for the existing
self-role-change guard, and for other request-body validation in this
codebase, e.g. UserService.changePassword()); the admin targeting their own
account -> 400, reusing that exact self-role-change guard; a nonexistent
target user id -> 404 (matching the "not found" RuntimeException ->
GlobalExceptionHandler sniffing "not found" in the message -> 404 pattern
used everywhere else, e.g. UserService.getUser()/deleteUser()).

This task PERMANENTLY mutates a user's role, so - unlike other files in this
folder - it does NOT touch the shared TempTest.py fixture accounts for any
role-assignment mutation (other test files in this folder depend on those
accounts keeping their original roles for the life of a test run). Instead
it registers a fresh throwaway user via POST /api/auth/register (always
ROLE_USER, no DB step needed), uses that as the target of every
role-assignment call, and deletes it again at the end via the existing
DELETE /api/users/{id} (ADMIN-only). It only reads (never mutates the role
of) the shared fixture accounts, via the already-logged-in tokens from
setup_users().

Usage:
    pip install requests
    python task02_admin_role_assignment.py

Requires pythonTests/TempTest.py to have been run at least once already
(creates/role-assigns the fixed test accounts) and the Spring Boot app
running on http://localhost:8080.
"""

import sys
import os
import uuid

sys.path.insert(0, os.path.dirname(__file__))
from common import (  # noqa: E402
    call, record, section, skip, guarded, setup_users, print_summary, PASSWORD,
)

# Assumed wire shape - update to match the real implementation.
ROLE_BODY_KEY = "role"


def role_endpoint(user_id):
    return f"/admin/users/{user_id}/role"


NONEXISTENT_USER_ID = 999999999

users = setup_users()

# ---------------------------------------------------------------------------
# Setup: register a fresh throwaway ROLE_USER target - never touch the
# shared TempTest.py fixture accounts' roles.
# ---------------------------------------------------------------------------
section("Setup: register a throwaway user as the role-assignment target")

throwaway_email = f"admin-role-test-{uuid.uuid4().hex[:8]}@loanlite.test"
reg = call("POST", "/auth/register",
           json={"email": throwaway_email, "password": PASSWORD, "firstName": "Throwaway", "lastName": "Target"},
           expect=201, label=f"register throwaway target user {throwaway_email}")

if not reg.ok:
    skip("Task 2 checks skipped, could not register the throwaway target user")
    print_summary()

throwaway = reg.json()
throwaway_id = throwaway["id"]
record(throwaway.get("role") == "ROLE_USER",
       f"throwaway user is registered as ROLE_USER by default (got {throwaway.get('role')})")


def fetch_user_as_admin(user_id, label):
    r = call("GET", f"/users/{user_id}", token=users.admin.token, expect=200, label=label)
    return r.json() if r.ok else None


# ---------------------------------------------------------------------------
# Unauthenticated / wrong-role access to the new endpoint
# ---------------------------------------------------------------------------
section("Task 2: the role-assignment endpoint is ADMIN-only")

call("PATCH", role_endpoint(throwaway_id), json={ROLE_BODY_KEY: "ROLE_PROCESSOR"}, expect=401,
     label="no token calls the role-assignment endpoint (should be unauthorized)")

for role_label, user in (("applicant", users.applicant), ("processor", users.processor),
                          ("underwriter", users.underwriter)):
    call("PATCH", role_endpoint(throwaway_id), token=user.token, json={ROLE_BODY_KEY: "ROLE_PROCESSOR"},
         expect=403, label=f"{role_label} calls the role-assignment endpoint (should be forbidden)")

# ---------------------------------------------------------------------------
# Admin assigns ROLE_PROCESSOR - the point of the task: a minimal,
# field-scoped update rather than the generic full-entity PUT.
# ---------------------------------------------------------------------------
section("Task 2: admin assigns a valid role, and only the role field changes")

call("PATCH", role_endpoint(throwaway_id), token=users.admin.token, json={ROLE_BODY_KEY: "ROLE_PROCESSOR"},
     expect=200, label="admin assigns ROLE_PROCESSOR to the throwaway user")

after_assign = fetch_user_as_admin(throwaway_id, "fetch throwaway user after role assignment")
if after_assign is not None:
    record(after_assign.get("role") == "ROLE_PROCESSOR",
           f"throwaway user's role is now ROLE_PROCESSOR (got {after_assign.get('role')})")
    record(after_assign.get("email") == throwaway_email,
           "throwaway user's email is unchanged by the role-only update")
    record(after_assign.get("firstName") == "Throwaway",
           "throwaway user's firstName is unchanged by the role-only update")
    record(after_assign.get("lastName") == "Target",
           "throwaway user's lastName is unchanged by the role-only update")
else:
    skip("Field-scoping checks after role assignment skipped, could not re-fetch the throwaway user")

# ---------------------------------------------------------------------------
# Invalid role string is rejected, and does not change anything
# ---------------------------------------------------------------------------
section("Task 2: an unknown role string is rejected")

call("PATCH", role_endpoint(throwaway_id), token=users.admin.token, json={ROLE_BODY_KEY: "ROLE_BOGUS"},
     expect=400, label="admin assigns an invalid role string (should be a bad request)")

after_invalid = fetch_user_as_admin(throwaway_id, "fetch throwaway user after rejected invalid-role attempt")
if after_invalid is not None:
    record(after_invalid.get("role") == "ROLE_PROCESSOR",
           f"throwaway user's role is unchanged after the rejected invalid-role attempt (got {after_invalid.get('role')})")
else:
    skip("Post-invalid-role unchanged-role check skipped, could not re-fetch the throwaway user")

# ---------------------------------------------------------------------------
# Missing / blank role field is rejected
# ---------------------------------------------------------------------------
section("Task 2: a missing role field is rejected")

call("PATCH", role_endpoint(throwaway_id), token=users.admin.token, json={}, expect=400,
     label="admin sends an empty body to the role-assignment endpoint (should be a bad request)")
call("PATCH", role_endpoint(throwaway_id), token=users.admin.token, json={ROLE_BODY_KEY: ""}, expect=400,
     label="admin sends a blank role field to the role-assignment endpoint (should be a bad request)")

after_missing = fetch_user_as_admin(throwaway_id, "fetch throwaway user after rejected missing/blank-role attempts")
if after_missing is not None:
    record(after_missing.get("role") == "ROLE_PROCESSOR",
           f"throwaway user's role is unchanged after rejected missing/blank-role attempts (got {after_missing.get('role')})")
else:
    skip("Post-missing-role unchanged-role check skipped, could not re-fetch the throwaway user")

# ---------------------------------------------------------------------------
# Nonexistent target user id
# ---------------------------------------------------------------------------
section("Task 2: a nonexistent target user id is a 404")

call("PATCH", role_endpoint(NONEXISTENT_USER_ID), token=users.admin.token, json={ROLE_BODY_KEY: "ROLE_PROCESSOR"},
     expect=404, label="admin assigns a role to a nonexistent user id (should be not found)")

# ---------------------------------------------------------------------------
# An admin cannot use this endpoint to change their OWN role either - the
# existing self-role-change guard from UserController.update() must carry
# over to this new endpoint.
# ---------------------------------------------------------------------------
section("Task 2: an admin cannot assign themself a role through this endpoint")

admin_before = fetch_user_as_admin(users.admin.id, "fetch admin's own record before self-role-change attempt")

call("PATCH", role_endpoint(users.admin.id), token=users.admin.token, json={ROLE_BODY_KEY: "ROLE_USER"},
     expect=400, label="admin tries to change their own role via the new endpoint (should be blocked, same as PUT)")

admin_after = fetch_user_as_admin(users.admin.id, "fetch admin's own record after self-role-change attempt")
if admin_before is not None and admin_after is not None:
    record(admin_after.get("role") == admin_before.get("role"),
           f"admin's own role is unchanged after the blocked self-role-change attempt "
           f"(was {admin_before.get('role')}, now {admin_after.get('role')})")
else:
    skip("Self-role-change unchanged-role check skipped, could not fetch the admin's own record")

# ---------------------------------------------------------------------------
# Assign the throwaway user back to a different role again, to confirm the
# endpoint supports more than a single one-shot transition.
# ---------------------------------------------------------------------------
section("Task 2: the throwaway user's role can be changed again")

call("PATCH", role_endpoint(throwaway_id), token=users.admin.token, json={ROLE_BODY_KEY: "ROLE_UNDERWRITER"},
     expect=200, label="admin re-assigns the throwaway user to ROLE_UNDERWRITER")

after_reassign = fetch_user_as_admin(throwaway_id, "fetch throwaway user after second role assignment")
if after_reassign is not None:
    record(after_reassign.get("role") == "ROLE_UNDERWRITER",
           f"throwaway user's role is now ROLE_UNDERWRITER (got {after_reassign.get('role')})")
else:
    skip("Second-assignment role check skipped, could not re-fetch the throwaway user")

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------
section("Cleanup")

guarded(
    f"/users/{throwaway_id}", users.admin.token,
    lambda: call("DELETE", f"/users/{throwaway_id}", token=users.admin.token, expect=204,
                 label=f"cleanup: delete throwaway user {throwaway_id}"),
    f"cleanup: delete throwaway user {throwaway_id}",
)

print_summary()
