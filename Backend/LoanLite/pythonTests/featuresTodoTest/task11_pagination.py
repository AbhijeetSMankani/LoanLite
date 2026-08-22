"""
todo/featuresTodo.csv - Task 11: Add pagination support to all data-list endpoints.

Design under test (see the CSV row for full background): every list-returning
endpoint currently returns a full, unbounded JSON array with no page/size/sort
query params:

    GET /api/applications
    GET /api/documents
    GET /api/application-history
    GET /api/users
    GET /api/processor/work-list
    GET /api/underwriter/work-list

The feature adds Spring Data Pageable support across all six: accept
page/size/sort request params, change repository methods to return Page<T>
instead of List<T>, and have each controller return a Page<T> instead of a
bare array. Spring Data's default JSON serialization of a Page is an object
shaped like:

    {"content": [...], "totalElements": N, "totalPages": N, "size": N,
     "number": N, "first": bool, "last": bool, "numberOfElements": N,
     "empty": bool, ...}

The EXACT response shape isn't locked in yet (a bare Page vs. some custom
wrapper), so this file only asserts the one thing we're fairly confident
about: a dict with a "content" key holding a list. See is_page_shaped()
below - if the real implementation wraps pages differently (e.g. nests the
Page under a "data" key, or renames "content"), update is_page_shaped()
to match rather than rewriting every call site.

Until this feature lands, every list endpoint still returns a bare array,
so is_page_shaped() will fail on all of them (a list is not a dict) - that
is expected and is exactly the "not implemented yet" signal this harness is
designed to produce.

Usage:
    pip install requests
    python task11_pagination.py

Requires pythonTests/TempTest.py to have been run at least once already
(creates/role-assigns the fixed test accounts) and the Spring Boot app
running on http://localhost:8080.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
from common import (  # noqa: E402
    call, record, section, skip, guarded, setup_users, create_application,
    upload_document, upload_all_required_documents, history_for_application,
    cleanup_application, print_summary,
)


def is_page_shaped(body):
    """True if `body` looks like Spring Data's default Page<T> JSON: a dict
    with a "content" key whose value is a list. This is an ASSUMPTION about
    the eventual response shape - adjust here (not at each call site) if the
    real implementation wraps pages differently."""
    return isinstance(body, dict) and isinstance(body.get("content"), list)


users = setup_users()

# ---------------------------------------------------------------------------
# Setup: seed at least one application (+ one document) so the paginated
# lists aren't just querying an empty table.
# ---------------------------------------------------------------------------
section("Task 11: setup - seed one application and one document")

seed_app = create_application(users.applicant, label="create application to seed pagination checks")
seed_doc_ids = []
if seed_app:
    seed_app_id = seed_app["id"]
    r = upload_document(seed_app_id, users.applicant.token, "PAN_CARD",
                         label="upload a document to seed pagination checks")
    if r.ok:
        seed_doc_ids.append(r.json()["id"])
else:
    seed_app_id = None
    skip("Pagination checks proceeding without a freshly seeded application (create_application failed)")

# ---------------------------------------------------------------------------
# Positive checks: each list endpoint returns a Page-shaped body when given
# page/size params, and honors "size" (at most `size` items in "content").
# ---------------------------------------------------------------------------
section("Task 11: list endpoints return a paginated (Page-shaped) body")

PAGE_ENDPOINTS = [
    ("/applications", users.applicant, "applicant lists applications, paginated"),
    ("/documents", users.admin, "admin lists documents, paginated"),
    ("/application-history", users.admin, "admin lists application-history, paginated"),
    ("/users", users.admin, "admin lists users, paginated"),
    ("/processor/work-list", users.processor, "processor lists work-list, paginated"),
    ("/underwriter/work-list", users.underwriter, "underwriter lists work-list, paginated"),
]

for path, user, label in PAGE_ENDPOINTS:
    r = call("GET", path, token=user.token, params={"page": 0, "size": 1}, expect=200, label=label)
    if r.ok:
        body = r.json()
        if record(is_page_shaped(body), f"{label}: response body is Page-shaped (has a list 'content' key)"):
            record(len(body["content"]) <= 1, f"{label}: 'content' respects size=1 (got {len(body['content'])})")
    else:
        skip(f"{label}: Page-shape checks skipped, request did not return 200")

# ---------------------------------------------------------------------------
# Negative/regression checks: existing auth rules must not regress just
# because pagination params were added to these endpoints.
# ---------------------------------------------------------------------------
section("Task 11: existing auth rules are unaffected by pagination")

call("GET", "/applications", token=None, expect=401,
     label="anonymous lists applications without a token (should still be unauthorized)")

call("GET", "/users", token=users.applicant.token, params={"page": 0, "size": 1}, expect=403,
     label="applicant lists users, paginated (should still be ADMIN only)")

call("GET", "/processor/work-list", token=users.applicant.token, params={"page": 0, "size": 1}, expect=403,
     label="applicant lists processor work-list, paginated (should still be PROCESSOR only)")

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------
if seed_app_id:
    cleanup_application(seed_app_id, users.admin, doc_ids=seed_doc_ids)

print_summary()
