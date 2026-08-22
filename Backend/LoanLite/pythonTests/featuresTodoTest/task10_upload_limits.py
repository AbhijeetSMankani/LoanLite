"""
todo/featuresTodo.csv - Task 10: Add file upload content-type and size limits.

Design under test (see the CSV row for full background):
LoanApplicationController.uploadDocument() (POST /api/applications/{id}/documents)
already sanitizes filenames (no path-traversal risk), but currently accepts any
content-type/extension and any file size - Spring Boot's silent multipart
defaults (1MB per file / 10MB per request) apply because no
spring.servlet.multipart.max-file-size/max-request-size properties are set.

This task is only scoped, not designed in detail yet: the exact allow-list of
accepted content-types/extensions and the exact chosen max-file-size are NOT
decided. The constants below are this test's ASSUMPTIONS - update them to
match the real implementation once it lands rather than rewriting the checks;
everything else (that an allow-listed upload still works, that a disallowed
content-type is rejected with 400, that an oversized file is rejected) holds
regardless of the exact values chosen.

    ASSUMED_ALLOWED_CONTENT_TYPES  - guess, confirm against the real allow-list
    ASSUMED_DISALLOWED_CONTENT_TYPE - text/html, deliberately the stored-XSS
                                       risk type the CSV's own reasoning calls out
    ASSUMED_MAX_FILE_SIZE_BYTES    - guess, confirm against the real
                                       spring.servlet.multipart.max-file-size

Usage:
    pip install requests
    python task10_upload_limits.py

Requires pythonTests/TempTest.py to have been run at least once already
(creates/role-assigns the fixed test accounts) and the Spring Boot app
running on http://localhost:8080.
"""

import io
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
from common import (  # noqa: E402
    call, record, section, skip, guarded, setup_users, create_application,
    cleanup_application, print_summary,
)

# ---------------------------------------------------------------------------
# Assumptions - NOT yet confirmed against a real implementation. Correct these
# once Task 10 actually lands.
# ---------------------------------------------------------------------------
ASSUMED_ALLOWED_CONTENT_TYPES = {"application/pdf", "image/jpeg", "image/png"}  # guess - confirm against real allow-list
ASSUMED_DISALLOWED_CONTENT_TYPE = "text/html"  # deliberately an XSS-risk type per the CSV's own reasoning
ASSUMED_DISALLOWED_CONTENT_TYPE_2 = "application/x-msdownload"  # another plausible disallowed type (executable)
ASSUMED_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5MB - guess, confirm against the real spring.servlet.multipart.max-file-size

users = setup_users()


def upload_raw(app_id, token, filename, content_type, content_bytes, expect=None, label=None):
    """Custom variant of common.upload_document() - that helper hardcodes a
    text/plain dummy file and doesn't let us control content-type or size,
    both of which are exactly what this task is testing."""
    files = {"file": (filename, io.BytesIO(content_bytes), content_type)}
    data = {"documentType": "PAN_CARD"}
    return call("POST", f"/applications/{app_id}/documents", token=token,
                files=files, data=data, expect=expect,
                label=label or f"upload {filename} ({content_type}, {len(content_bytes)} bytes)")


# ---------------------------------------------------------------------------
# Positive: an allow-listed content-type still works
# ---------------------------------------------------------------------------
section("Task 10: an allow-listed content-type is still accepted")

app = create_application(users.applicant, label="create application for allow-listed upload check")
doc_ids = []
if not app:
    skip("Allow-listed upload check skipped, could not create the application")
else:
    app_id = app["id"]
    allowed_type = next(iter(ASSUMED_ALLOWED_CONTENT_TYPES))
    r = upload_raw(app_id, users.applicant.token, "doc.pdf", allowed_type, b"%PDF-1.4 dummy pdf contents",
                    expect=201, label=f"applicant uploads doc.pdf ({allowed_type}) on a fresh application")
    if r.ok:
        doc_ids.append(r.json()["id"])

    # -----------------------------------------------------------------------
    # Negative: a disallowed content-type is rejected - the XSS-risk case
    # -----------------------------------------------------------------------
    section("Task 10: a disallowed content-type is rejected (stored-XSS risk)")

    call("POST", f"/applications/{app_id}/documents", token=users.applicant.token,
         files={"file": ("doc.html", io.BytesIO(b"<script>alert(1)</script>"), ASSUMED_DISALLOWED_CONTENT_TYPE)},
         data={"documentType": "PAN_CARD"}, expect=400,
         label=f"applicant uploads doc.html ({ASSUMED_DISALLOWED_CONTENT_TYPE}) - should be rejected")

    # -----------------------------------------------------------------------
    # Negative: another plausible disallowed content-type (executable)
    # -----------------------------------------------------------------------
    section("Task 10: another disallowed content-type is rejected (executable)")

    call("POST", f"/applications/{app_id}/documents", token=users.applicant.token,
         files={"file": ("malware.exe", io.BytesIO(b"MZ dummy exe contents"), ASSUMED_DISALLOWED_CONTENT_TYPE_2)},
         data={"documentType": "PAN_CARD"}, expect=400,
         label=f"applicant uploads malware.exe ({ASSUMED_DISALLOWED_CONTENT_TYPE_2}) - should be rejected")

    cleanup_application(app_id, users.admin, doc_ids=doc_ids)

# ---------------------------------------------------------------------------
# Negative: a file exceeding the assumed max size is rejected, type is fine
# ---------------------------------------------------------------------------
section("Task 10: a file exceeding the max size is rejected")

size_app = create_application(users.applicant, label="create application for oversized-upload check")
if not size_app:
    skip("Oversized-upload check skipped, could not create the application")
else:
    size_app_id = size_app["id"]
    oversized_type = next(iter(ASSUMED_ALLOWED_CONTENT_TYPES))
    oversized_payload = io.BytesIO(b"0" * (ASSUMED_MAX_FILE_SIZE_BYTES + 1024))

    # Spring's own multipart-size-exceeded handling might surface as 400, 413,
    # or even 500 depending on how/whether it's caught by the controller/a
    # @ControllerAdvice. Assert 400 as the primary expectation via call(), but
    # also do a flexible raw-request fallback check accepting 400 or 413.
    resp = call("POST", f"/applications/{size_app_id}/documents", token=users.applicant.token,
                files={"file": ("big.pdf", oversized_payload, oversized_type)},
                data={"documentType": "PAN_CARD"}, expect=None,
                label=f"applicant uploads an oversized file ({ASSUMED_MAX_FILE_SIZE_BYTES + 1024} bytes, {oversized_type})")
    record(resp.status_code == 400,
           f"oversized upload rejected with 400 (primary expectation, got {resp.status_code})")
    record(resp.status_code in (400, 413),
           f"oversized upload rejected with 400 or 413 (flexible fallback, got {resp.status_code})")

    cleanup_application(size_app_id, users.admin)

# ---------------------------------------------------------------------------
# Control: a second, separate, small allow-listed upload still succeeds -
# makes sure the type/size checks above aren't accidentally blocking everything
# ---------------------------------------------------------------------------
section("Task 10: control - a normal-sized allow-listed upload on a different application still succeeds")

control_app = create_application(users.applicant, label="create application for control upload check")
if not control_app:
    skip("Control upload check skipped, could not create the application")
else:
    control_app_id = control_app["id"]
    control_type = next(iter(ASSUMED_ALLOWED_CONTENT_TYPES))
    r = upload_raw(control_app_id, users.applicant.token, "control.pdf", control_type, b"%PDF-1.4 small control pdf",
                    expect=201, label=f"applicant uploads control.pdf ({control_type}) as a sanity control")
    control_doc_ids = [r.json()["id"]] if r.ok else []
    cleanup_application(control_app_id, users.admin, doc_ids=control_doc_ids)

# ---------------------------------------------------------------------------
# Negative: unauthenticated upload stays 401 (existing behavior, kept
# self-contained per convention)
# ---------------------------------------------------------------------------
section("Task 10: unauthenticated upload is rejected")

auth_app = create_application(users.applicant, label="create application for unauthenticated-upload check")
if not auth_app:
    skip("Unauthenticated upload check skipped, could not create the application")
else:
    auth_app_id = auth_app["id"]
    allowed_type = next(iter(ASSUMED_ALLOWED_CONTENT_TYPES))
    call("POST", f"/applications/{auth_app_id}/documents", token=None,
         files={"file": ("doc.pdf", io.BytesIO(b"%PDF-1.4 dummy pdf contents"), allowed_type)},
         data={"documentType": "PAN_CARD"}, expect=401,
         label="unauthenticated request to upload a document (should be rejected)")

    cleanup_application(auth_app_id, users.admin)

print_summary()
