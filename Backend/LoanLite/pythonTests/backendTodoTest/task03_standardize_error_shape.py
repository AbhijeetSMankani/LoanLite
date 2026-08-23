"""
todo/backendTodo.csv - Task 3: Standardize error response shape - stop
mixing empty-body and JSON error responses.

Design under test (see the CSV row for full background): 22 call sites
across every controller used to return an empty body
(ResponseEntity.status(X).build() / .notFound().build() / .badRequest().build())
instead of the consistent JSON shape ({timestamp, status, error, message, path})
GlobalExceptionHandler produces for every thrown exception.

The fix: a new ApiException(HttpStatus, message) type, thrown from each of
those 22 sites instead of returning an empty body, handled by a new
@ExceptionHandler(ApiException.class) in GlobalExceptionHandler that maps
straight to the existing JSON shape. AuthController.changePassword() also
had its own bespoke case (catching IllegalArgumentException and returning
a bare 400) - that one now just lets the exception propagate to the
existing IllegalArgumentException handler instead.

This file spot-checks a representative sample of the 22 sites (not all of
them - that would just re-run every other test file's ownership checks)
to confirm they now return the JSON error shape with a non-empty message,
instead of an empty body. Every OTHER task's test file (and TempTest.py)
already exercises these same call sites for their actual status code -
this file only adds the "and the body isn't empty, and it's the right
JSON shape" assertion on top.

Until this lands, the checks below are EXPECTED to FAIL (today these
responses have an empty body) - that failure is the whole point of
pre-writing this regression test.

Usage:
    pip install requests
    python task03_standardize_error_shape.py

Requires pythonTests/TempTest.py to have been run at least once already
(creates/role-assigns the fixed test accounts) and the Spring Boot app
running on http://localhost:8080.
"""

import sys
import os
import io

sys.path.insert(0, os.path.dirname(__file__))
from common import (  # noqa: E402
    call, record, section, setup_users, create_application, upload_document,
    cleanup_application, print_summary, BASE, auth, TIMEOUT,
)

import requests  # noqa: E402

users = setup_users()

JSON_ERROR_KEYS = {"timestamp", "status", "error", "message", "path"}


def assert_json_error_shape(resp, expected_status, label):
    """Checks the response is the standard JSON error shape with a real,
    non-empty message - not an empty body."""
    ok_status = record(resp.status_code == expected_status,
                        f"{label} -> expected {expected_status}, got {resp.status_code}")
    if not ok_status:
        return
    try:
        body = resp.json()
    except ValueError:
        record(False, f"{label}: response body is not JSON at all (got: {resp.text[:200]!r})")
        return
    has_all_keys = isinstance(body, dict) and JSON_ERROR_KEYS.issubset(body.keys())
    record(has_all_keys, f"{label}: body has the standard JSON error shape {JSON_ERROR_KEYS} (got keys: "
                          f"{list(body.keys()) if isinstance(body, dict) else type(body)})")
    if has_all_keys:
        record(bool(body.get("message")), f"{label}: message is non-empty (got {body.get('message')!r})")
        record(body.get("status") == expected_status,
               f"{label}: body's status field matches the HTTP status (got {body.get('status')!r})")


# ---------------------------------------------------------------------------
# Setup: an application + document to exercise a representative sample of
# the 22 fixed call sites across several controllers.
# ---------------------------------------------------------------------------
section("Task 3: setup")

app = create_application(users.applicant, label="create application for error-shape check")
app_id = app["id"] if app else None
doc_id = None
if app_id:
    r = upload_document(app_id, users.applicant.token, "PAN_CARD", label="upload PAN_CARD for error-shape check")
    doc_id = r.json()["id"] if r.ok else None

# ---------------------------------------------------------------------------
# LoanApplicationController.getApplication - manual 403 (ApiException)
# ---------------------------------------------------------------------------
section("Task 3: LoanApplicationController manual 403s are now the JSON error shape")

if app_id:
    r = call("GET", f"/applications/{app_id}", token=users.applicant2.token,
              label="unrelated applicant2 reads someone else's application")
    assert_json_error_shape(r, 403, "GET /applications/{id} as an unrelated applicant")

# ---------------------------------------------------------------------------
# LoanApplicationController.getByApplicationNumber - manual 404 (ApiException),
# previously ResponseEntity.notFound().build() (empty body)
# ---------------------------------------------------------------------------
section("Task 3: application-number 404 is now the JSON error shape (was an empty 404 body)")

r = call("GET", "/applications/application-number/APP-DOES-NOT-EXIST-12345", token=users.applicant.token,
          label="lookup a nonexistent application number")
assert_json_error_shape(r, 404, "GET /applications/application-number/{n} for a nonexistent number")

# ---------------------------------------------------------------------------
# LoanApplicationController.uploadDocument - manual 400 (ApiException),
# previously ResponseEntity.badRequest().build() (empty body). Note: the
# controller's `file == null || file.isEmpty()` check only ever fires for a
# PRESENT-but-empty file part - a fully MISSING file part never reaches the
# controller body at all (Spring's own MissingServletRequestPartException
# fires first, an unrelated pre-existing 500 gap, not part of this task).
# ---------------------------------------------------------------------------
section("Task 3: empty-file 400 is now the JSON error shape (was an empty 400 body)")

if app_id:
    url = f"{BASE}/applications/{app_id}/documents"
    files = {"file": ("empty.pdf", io.BytesIO(b""), "application/pdf")}
    resp = requests.post(url, headers=auth(users.applicant.token), files=files,
                          data={"documentType": "OTHER"}, timeout=TIMEOUT)
    assert_json_error_shape(resp, 400, "POST /applications/{id}/documents with an empty file")

# ---------------------------------------------------------------------------
# DocumentController.get - manual 403 (ApiException)
# ---------------------------------------------------------------------------
section("Task 3: DocumentController manual 403 is now the JSON error shape")

if doc_id:
    r = call("GET", f"/documents/{doc_id}", token=users.applicant2.token,
              label="unrelated applicant2 reads someone else's document")
    assert_json_error_shape(r, 403, "GET /documents/{id} as an unrelated applicant")

# ---------------------------------------------------------------------------
# UserController.get - manual 403 (ApiException)
# ---------------------------------------------------------------------------
section("Task 3: UserController manual 403 is now the JSON error shape")

r = call("GET", f"/users/{users.applicant.id}", token=users.applicant2.token,
          label="applicant2 reads a different user's account")
assert_json_error_shape(r, 403, "GET /users/{id} as a different non-admin user")

# ---------------------------------------------------------------------------
# AuthController.changePassword - previously a caught IllegalArgumentException
# turned into a bare ResponseEntity.badRequest().build(); now propagates
# ---------------------------------------------------------------------------
section("Task 3: change-password wrong-current-password 400 is now the JSON error shape")

r = call("POST", "/auth/change-password", token=users.applicant.token,
          json={"currentPassword": "definitely-wrong", "newPassword": "NewPass123!"},
          label="applicant changes password with the wrong current password")
assert_json_error_shape(r, 400, "POST /auth/change-password with a wrong current password")

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------
if app_id:
    cleanup_application(app_id, users.admin, doc_ids=[doc_id] if doc_id else [])

print_summary()
