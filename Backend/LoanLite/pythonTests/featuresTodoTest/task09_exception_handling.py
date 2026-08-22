"""
todo/featuresTodo.csv - Task 9: Stop the global exception handler from
leaking raw exception messages on 500s.

Design under test (see the CSV row for full background):
GlobalExceptionHandler's handleAny(Exception) and the generic-RuntimeException
fallback in handleRuntime() both build their response body via a shared
build() method that currently does `body.put("message", ex.getMessage())`
UNCONDITIONALLY. For anything that isn't one of the deliberately-handled
types (IllegalArgumentException/IllegalStateException, where the message IS
meant to be client-facing), this puts the raw exception message straight
into a 500 response - which can leak SQL constraint text, NPE internals,
file paths, etc.

The fix has two parts:
  1. The generic 500 fallback (handleAny / generic RuntimeException case)
     must stop putting ex.getMessage() in the response body - log it
     server-side instead, return a generic client-facing message. The
     message-in-body behavior stays for the deliberately-handled
     IllegalArgumentException/IllegalStateException cases.
  2. UserService.updateUser() must gain a duplicate-email check (mirroring
     createUser()'s existing check) so that PUT /api/users/{id} with an
     already-taken email returns a clean 400 instead of ever reaching the
     database's unique constraint and bubbling a DataIntegrityViolationException
     message back as a raw 500.

NOTE: this file only exercises part 2 (the duplicate-email fix) directly.
There is no other reliable, deterministic way to trigger the generic-500
fallback over plain HTTP without deeper knowledge of the codebase's other
failure modes, so part 1 ("no raw ex.getMessage() leak on generic 500s") is
only indirectly covered here: once the duplicate-email check lands, that
request path returns a clean 400 and never reaches the generic 500/leak
path at all. The "no leak" assertion below is a stand-in checking that
whatever message IS returned doesn't look like a raw DB/stack-trace leak.

CRITICAL: this file must not touch the shared TempTest.py fixture accounts'
emails. It registers two throwaway users of its own (task9-user-a@loanlite.test
/ task9-user-b@loanlite.test) via POST /auth/register, and deletes both at
the end using the admin account from setup_users().

Usage:
    pip install requests
    python task09_exception_handling.py

Requires pythonTests/TempTest.py to have been run at least once already
(creates/role-assigns the fixed test accounts) and the Spring Boot app
running on http://localhost:8080.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
from common import (  # noqa: E402
    call, record, section, skip, guarded, setup_users, whoami, PASSWORD,
    response_snippet, print_summary,
)

# Substrings that would indicate a raw DB/stack-trace leak reaching the client.
LEAK_SUBSTRINGS = (
    "constraint",
    "sqlexception",
    "dataintegrityviolation",
    "nullpointerexception",
    "at com.loanlite",
)

USER_A_EMAIL = "task9-user-a@loanlite.test"
USER_B_EMAIL = "task9-user-b@loanlite.test"


def register(email, first, last):
    r = call(
        "POST", "/auth/register",
        json={"email": email, "password": PASSWORD, "firstName": first, "lastName": last},
        expect=201, label=f"register throwaway user {email}",
    )
    return r.json() if r.ok else None


def login(email):
    r = call(
        "POST", "/auth/login",
        json={"email": email, "password": PASSWORD},
        expect=200, label=f"login throwaway user {email}",
    )
    return r.json().get("token") if r.ok else None


users = setup_users()

# ---------------------------------------------------------------------------
# Setup: two throwaway users, not the shared TempTest.py fixture accounts
# ---------------------------------------------------------------------------
section("Task 9: setup throwaway users A and B")

user_a_id = None
user_b_id = None
user_a_token = None
user_b_token = None

if register(USER_A_EMAIL, "Task9", "UserA"):
    user_a_token = login(USER_A_EMAIL)
if register(USER_B_EMAIL, "Task9", "UserB"):
    user_b_token = login(USER_B_EMAIL)

if user_a_token:
    me_a = whoami(user_a_token, "fetch throwaway user A via /auth/me")
    user_a_id = me_a.get("id") if me_a else None
if user_b_token:
    me_b = whoami(user_b_token, "fetch throwaway user B via /auth/me")
    user_b_id = me_b.get("id") if me_b else None

if not user_a_id or not user_b_id:
    skip("Task 9 checks skipped, could not set up both throwaway users")
else:
    # -----------------------------------------------------------------
    # Core regression: duplicate email on PUT must be a clean 400, not 500
    # -----------------------------------------------------------------
    section("Task 9: duplicate email on user update returns 400, not a raw 500")

    dup_resp = call(
        "PUT", f"/users/{user_b_id}", token=users.admin.token,
        json={"email": USER_A_EMAIL}, expect=400,
        label="admin tries to change user B's email to user A's already-taken email",
    )

    body_text = response_snippet(dup_resp, limit=2000).lower()
    leaked = [s for s in LEAK_SUBSTRINGS if s in body_text]
    record(not leaked,
           "duplicate-email error message doesn't leak internal exception details"
           + (f" (found: {leaked}, body: {body_text[:300]})" if leaked else ""))

    # -----------------------------------------------------------------
    # User B's email must be unchanged after the failed attempt
    # -----------------------------------------------------------------
    section("Task 9: failed duplicate-email update did not actually change anything")

    check_resp = call(
        "GET", f"/users/{user_b_id}", token=users.admin.token, expect=200,
        label="admin fetches user B after the failed duplicate-email update",
    )
    if check_resp.ok:
        still_b_email = check_resp.json().get("email")
        record(still_b_email == USER_B_EMAIL,
               f"user B's email is still {USER_B_EMAIL} unchanged (got {still_b_email})")

    # -----------------------------------------------------------------
    # Sanity: a legitimate email update still works
    # -----------------------------------------------------------------
    section("Task 9: legitimate email update still succeeds")

    new_email = "task9-user-b-renamed@loanlite.test"
    legit_resp = call(
        "PUT", f"/users/{user_b_id}", token=users.admin.token,
        json={"email": new_email}, expect=200,
        label="admin updates user B to a genuinely new, unique email",
    )
    if legit_resp.ok:
        record(legit_resp.json().get("email") == new_email,
               f"user B's email is now {new_email} (got {legit_resp.json().get('email')})")

    # -----------------------------------------------------------------
    # Existing behavior, unaffected: unauthenticated update is rejected
    # -----------------------------------------------------------------
    section("Task 9: unauthenticated update is still rejected")

    call("PUT", f"/users/{user_b_id}", token=None, json={"email": "whatever@loanlite.test"},
         expect=401, label="unauthenticated PUT to update a user (should be unauthorized)")

# ---------------------------------------------------------------------------
# Cleanup: delete both throwaway users, best-effort
# ---------------------------------------------------------------------------
section("Task 9: cleanup throwaway users")

if user_a_id:
    guarded(
        f"/users/{user_a_id}", users.admin.token,
        lambda: call("DELETE", f"/users/{user_a_id}", token=users.admin.token, expect=204,
                     label="cleanup: delete throwaway user A"),
        "cleanup: delete throwaway user A",
    )
if user_b_id:
    guarded(
        f"/users/{user_b_id}", users.admin.token,
        lambda: call("DELETE", f"/users/{user_b_id}", token=users.admin.token, expect=204,
                     label="cleanup: delete throwaway user B"),
        "cleanup: delete throwaway user B",
    )

print_summary()
