# LoanLite API Contract

Generated from the actual controller/entity/security code as of 2026-08-21 (working tree, includes
uncommitted `LoanApplicationController`/`UserController` changes and the new `UnderwriterController` /
`LoanApplicationAccessGuard`). This describes **what the backend does today**, including known gaps -
it is not an aspirational spec. Gaps are called out explicitly so the frontend doesn't build against
protections that don't exist yet.

See also, in the repo root: `missingEndpoint.csv` (auth endpoints not implemented), `todo/preAuthorizeTodo.csv`
(access-control lockdown in progress), `todo/frontendContractTodo.csv` (known frontend/backend mismatches
found so far).

---

## 1. Conventions

**Base URL:** `http://localhost:8080` (`server.port=8080`, no `server.servlet.context-path` set).

**No CORS configuration exists anywhere in the backend** (no `CorsConfigurationSource` bean, no
`WebMvcConfigurer.addCorsMappings`). If the frontend runs on a different origin/port (e.g. Vite on
`:5173`), every request will fail CORS preflight until a CORS config is added backend-side. This isn't
a frontend-side fix.

**Auth:** JWT bearer token.
- Obtain it from `POST /api/auth/login` or `POST /api/auth/register` (register does **not** return a token - see below).
- Send it as `Authorization: Bearer <token>` on every other request.
- Token expires in `jwt.expiration-ms` = **3600000 ms (1 hour)**, same in dev and prod. There is no refresh
  endpoint (see §7) - when it expires the user must log in again.
- No server-side session/logout - `POST /api/auth/logout` is a no-op; "logging out" just means the
  frontend deletes the stored token.

**Roles:** stored on `User.role` as `ROLE_USER`, `ROLE_ADMIN`, `ROLE_PROCESSOR`, `ROLE_UNDERWRITER`.
- **There is no `ROLE_APPLICANT`.** A self-registered user always gets `ROLE_USER`, and `ROLE_USER` *is*
  the applicant role.
- There is no self-serve role upgrade endpoint. `ROLE_ADMIN` / `ROLE_PROCESSOR` / `ROLE_UNDERWRITER`
  accounts get there because someone set `role` directly in the DB, or an admin called
  `PATCH /api/admin/users/{id}/role` (§3.8, the recommended way) or the generic `PUT /api/users/{id}`
  (§3.2). A real frontend build has no way to create a processor/underwriter/admin test account through
  the UI unless an admin account already exists to promote it.
- `@PreAuthorize("hasRole('X')")` checks against `ROLE_X` per Spring Security convention - you don't add
  the `ROLE_` prefix yourself when calling these endpoints, it's just internal.

**Error shape** - every non-2xx response (from `GlobalExceptionHandler`) has this JSON body:
```json
{
  "timestamp": "2026-08-21T10:15:30.123",
  "status": 404,
  "error": "Not Found",
  "message": "Loan application not found with id: 99",
  "path": "/api/applications/99"
}
```
Status mapping the frontend should expect:
| Thrown as | HTTP status | Notes |
|---|---|---|
| `AccessDeniedException` (`@PreAuthorize` failure) | 403 | |
| `AuthenticationException` (bad login credentials) | 401 | |
| `IllegalArgumentException` | 400 | e.g. duplicate email, wrong current password |
| `IllegalStateException` | 404 | used by `AuthController`'s "authenticated user not found" checks |
| `RuntimeException` whose message contains `"not found"` (case-insensitive) | 404 | this is how every service reports "no such id" - there's no dedicated `NotFoundException` type |
| any other `RuntimeException` | 500 | |
| anything else | 500 | |
| no/invalid/expired JWT on a protected route | 401 | via `HttpStatusEntryPoint` |

**Manual 403s:** several endpoints return `403 Forbidden` from an `if` check in the controller rather than
throwing - the body in those cases is **empty** (`ResponseEntity.status(FORBIDDEN).build()`), not the
JSON error shape above. This applies to most of `LoanApplicationController`'s ownership checks (see §4).

---

## 2. Data shapes (as actually serialized)

Most endpoints return JPA **entities** directly (not slim DTOs), so the JSON includes every field and
some nested objects. Two things to watch for:

- **`User.passwordHash` is never excluded from JSON.** Any response that includes a `User` object
  (directly from `/api/users/*`, or nested as `applicant`/`processor`/`underwriter` inside a
  `LoanApplication`) will include a `passwordHash` field containing the BCrypt hash. Never display or
  round-trip this field from the frontend; it's a backend hygiene gap, not something you're expected to use.
- On `LoanApplication`, `documents` and `applicationHistory` are eagerly included as nested arrays in
  every response that returns a `LoanApplication` (list/get/create/update/submit/withdraw/claim/verify)
  - you don't need a separate call just to get an application's document list, though one exists too
    (§4, `GET /api/applications/{id}/documents`).

### User
```ts
{
  id: number,
  email: string,
  passwordHash: string,   // BCrypt hash on read; raw password expected on write (see below)
  firstName: string,
  lastName: string,
  phone: string | null,
  role: "ROLE_USER" | "ROLE_ADMIN" | "ROLE_PROCESSOR" | "ROLE_UNDERWRITER",
  createdAt: string       // ISO LocalDateTime, e.g. "2026-08-21T10:15:30.123"
}
```
`passwordHash` is a misleading field name for **write** operations too: `UserController.create`/`update`
and `AuthController.register` all take the plaintext password in this same field and the service encodes
it server-side. There is no separate `password` field on the entity-backed endpoints (only the dedicated
auth DTOs below use a field literally called `password`).

### LoanApplication
```ts
{
  id: number,
  applicationNumber: string,        // unique; server auto-generates "APP-<timestamp>" if you omit/blank it on create
  applicant: User,                  // full nested User object (includes passwordHash)
  loanAmount: number | null,        // BigDecimal
  tenureMonths: number | null,
  declaredIncome: number | null,    // BigDecimal
  verifiedIncome: number | null,    // BigDecimal - staff-set only, see §4 create
  creditScore: number | null,       // staff-set only
  interestRate: number | null,      // BigDecimal - nothing in the backend ever computes or sets this; passthrough only
  emi: number | null,               // BigDecimal - same, no computation logic exists
  status: string,                   // free-text, see canonical values in §3 - no enum/validation
  recommendation: string | null,    // set only by POST /api/processor/applications/{id}/verify - see §3 for the exact values (inconsistent casing)
  recommendationReason: string | null,
  decision: string | null,          // NEVER set by any dedicated endpoint - see §7 gap notes
  decisionComments: string | null,  // set by processor's request-documents endpoint, otherwise unused
  processor: User | null,
  underwriter: User | null,
  submittedAt: string | null,
  createdAt: string,
  updatedAt: string,
  documents: Document[],            // nested, always present
  applicationHistory: ApplicationHistory[]  // nested; now written automatically as a side effect of submit/withdraw/claim/verify/document-status actions (§3.5)
}
```

### Document
```ts
{
  id: number,
  application: LoanApplication | null,  // present on some responses depending on serialization path; don't rely on it being populated from the applicant-facing upload flow
  documentType: string,        // free text, uppercased server-side. Recognized/"required" values: PAN_CARD, SALARY_SLIP, ADDRESS_PROOF. Anything else (e.g. default "OTHER") is accepted but not tracked as required.
  fileName: string,            // original uploaded filename
  filePath: string,            // server-local path like "uploads/applications/3/<uuid>_file.pdf" - not a URL, see §7 (no download endpoint exists)
  verificationStatus: string,  // free text, uppercased. Values actually used by backend logic: "PENDING" (set on upload), "REJECTED" (checked by verify logic). "VERIFIED"/others are accepted but not specifically handled anywhere.
  remarks: string | null,
  uploadedAt: string
}
```

### ApplicationHistory
```ts
{
  id: number,
  // NOT `application` - that field is stripped from every response (Jackson back-reference,
  // needed to avoid infinite recursion with LoanApplication.applicationHistory). Use this instead:
  applicationId: number | null,
  user: User | null,
  action: string | null,
  details: string | null,
  createdAt: string | null
}
```

### Canonical `LoanApplication.status` values actually produced by the backend
`Draft` → `Submitted` → `In Review` (processor claims) → `Waiting for Documents` *or* `Ready for Underwriter`
(processor verifies) → `In Underwriting Review` (underwriter claims). `Withdrawn` is a terminal state set
by the applicant at any time before/during the above via withdraw. **There is no terminal
approved/rejected status** - see §7. Matching is exact-string, case-sensitive in search/filter queries
(`l.status = :status` in JPQL) - `"submitted"` will not match `"Submitted"`.

---

## 3. Endpoint reference by controller

Legend for **Access**: role required by `@PreAuthorize`, plus any additional ownership/ business
rule enforced manually in the method body (these do **not** show up as an annotation - they're plain
`if` checks against `LoanApplicationAccessGuard`).

### 3.1 `AuthController` - `/api/auth`

| Method & Path | Access | Request Body | Success Response |
|---|---|---|---|
| `POST /api/auth/login` | Public | `{ email, password }` (`AuthRequest`) | `200` `{ tokenType: "Bearer", token: string }` (`AuthResponse`). Throws `AuthenticationException` → 401 on bad credentials. |
| `POST /api/auth/register` | Public | `{ email, password, firstName, lastName }` (`RegisterRequest`) | `201` `UserResponse` (`{ id, email, firstName, lastName, role }`) - **does not log the user in**, frontend must call `/login` separately afterward. Always creates with `role = ROLE_USER`. `password` here is stored as-is into `passwordHash` and then BCrypt-encoded server-side. Duplicate email → 400 `"email already in use"`. |
| `POST /api/auth/logout` | Public | none | `200` empty body. Pure no-op; no server state changes. |
| `GET /api/auth/me` | Any authenticated user (no explicit `@PreAuthorize`, covered by the global `authenticated()` rule - see §7 task 13) | none | `200` `UserResponse` for the caller. |
| `POST /api/auth/change-password` | Any authenticated user (same as above, no explicit annotation) | `{ currentPassword, newPassword }` (`ChangePasswordRequest`) | `200` empty body. `400` empty body if `currentPassword` is wrong or `newPassword` is blank (note: this specific 400 is returned manually, not via the global error-JSON shape - the controller catches `IllegalArgumentException` and returns a bare 400). |

### 3.2 `UserController` - `/api/users`

| Method & Path | Access | Request Body | Success Response |
|---|---|---|---|
| `POST /api/users` | `ROLE_ADMIN` only | Full `User` JSON: `{ email, passwordHash /* plaintext in, hash out */, firstName, lastName, phone, role }` | `201` created `User` (raw entity, includes `passwordHash`). |
| `GET /api/users/{id}` | Any authenticated user, **plus**: caller must be `ROLE_ADMIN` **or** `caller.email == target.email` | none | `200` `User`. `403` (empty body) if neither condition holds. |
| `GET /api/users` | `ROLE_ADMIN` only | none | `200` `User[]` - every user in the system, including `passwordHash`. |
| `PUT /api/users/{id}` | Any authenticated user, **plus** same admin-or-self rule as `GET /{id}` | Full `User` JSON (any field null-safe partial update - only non-null fields overwrite) | `200` updated `User`. `403` (empty body) if not admin/self. **`400`** (via `IllegalArgumentException` → global handler) if the caller targets **their own account** and sends a `role` different from their current one - this applies to admins too (self-role-change is blocked for everyone, not just non-admins - a prior version of this doc got that backwards). For a minimal, dedicated way to change *someone else's* role, prefer `PATCH /api/admin/users/{id}/role` (§3.8) over this full-entity endpoint. |
| `DELETE /api/users/{id}` | `ROLE_ADMIN` only | none | `204` no content. |

### 3.3 `LoanApplicationController` - mounted at **both** `/api/loan-applications` and `/api/applications` (identical routes on either prefix)

| Method & Path | Access | Request Body | Success Response |
|---|---|---|---|
| `POST /api/applications` | `ROLE_USER` only (`@PreAuthorize`) - **note: admins cannot create an application through this endpoint**, only plain applicants can | `LoanApplication` JSON. `applicant`, `status`, `recommendation`, `recommendationReason`, `decision`, `decisionComments`, `processor`, `underwriter`, `creditScore`, `verifiedIncome` are all silently overwritten/forced to `null`/`Draft`/caller regardless of what you send - only `applicationNumber` (auto-generated if blank), `loanAmount`, `tenureMonths`, `declaredIncome`, `interestRate`, `emi` are actually honored from the body. | `201` created `LoanApplication`. |
| `GET /api/applications` | Any authenticated user. Query params `status`, `processorId`, `underwriterId`, `applicantId` all optional. **Non-admins are force-scoped**: an applicant's `applicantId` is always overridden to their own id (any value they pass is ignored); a processor's `underwriterId`/applicant filters are ignored and `processorId` is forced to their own id; underwriter likewise forced to their own `underwriterId`. Admins' params pass through unchanged (including seeing everything if no params given). | none | `200` `LoanApplication[]`, filtered by exact-match AND of whichever params end up set. |
| `GET /api/applications/{id}` | Any authenticated user, **plus** `LoanApplicationAccessGuard.hasAccess`: owning applicant OR assigned processor OR assigned underwriter OR admin | none | `200` `LoanApplication`. `403` (empty body) otherwise. `404` (JSON) if id doesn't exist. |
| `GET /api/applications/application-number/{applicationNumber}` | Same access rule as above | none | `200` `LoanApplication`. `404` (empty body, via `ResponseEntity.notFound()` - **not** the JSON error shape) if no such application number. `403` (empty body) if found but caller lacks access. |
| `PUT /api/applications/{id}` | Same `hasAccess` rule as GET, **plus**: if caller is specifically the owning applicant, the application's current `status` must still be `Draft` (else `403`, empty body) and the incoming `status` field is force-nulled (ignored) even in Draft - applicants can never change status via this endpoint, only via submit/withdraw. Staff (assigned processor/underwriter) and admin can update at any status with no extra restriction. | Partial `LoanApplication` JSON - only non-null fields in the body overwrite existing values (service does a manual null-check merge, not a full replace) | `200` updated `LoanApplication`. |
| `PATCH /api/applications/submit/{id}` | Owning applicant only (`isOwningApplicant`) - **no staff/admin override at all**, even admin gets 403 | none | `200` `LoanApplication` with `status = "Submitted"` and `submittedAt` set (if not already). `403` (empty body) for anyone but the owner. |
| `PATCH /api/applications/withdraw/{id}` | Owning applicant only, same as submit - no staff/admin override | none | `200` `LoanApplication` with `status = "Withdrawn"`. `403` (empty body) otherwise. |
| `POST /api/applications/{id}/documents` | **No `@PreAuthorize` and no ownership check at all currently** - any authenticated user can upload a document onto *any* application id, not just their own (`preAuthorizeTodo.csv` task 8, "Not Started"). Don't build the frontend assuming this is locked down yet. | `multipart/form-data`: `file` (required), `documentType` (optional, default `"OTHER"`), `remarks` (optional) | `201` created `Document`. `400` empty body if `file` missing/empty. |
| `GET /api/applications/{id}/documents` | **Also no access check currently** - any authenticated user can list any application's documents (same gap as above) | none | `200` `{ documents: Document[], missingRequiredDocuments: string[] }` - the latter is whichever of `PAN_CARD`/`SALARY_SLIP`/`ADDRESS_PROOF` hasn't been uploaded yet. |
| `DELETE /api/applications/{id}` | `ROLE_ADMIN` only | none | `204` no content. Hard delete, no status guard. |

### 3.4 `DocumentController` - `/api/documents`

**Only `create`, `updateDocumentStatus`, and `requestDocuments` have explicit role checks below.**
`get`, `list`, `update`, `delete` currently have **no `@PreAuthorize` and no ownership check** - any
authenticated user (any role) can read, overwrite, or delete **any** document in the system through
these four. This is a real, current gap (`preAuthorizeTodo.csv` tasks 9/9c/9d, all "Not Started") - do
not build UI affordances (e.g. "delete my document" for applicants) assuming server-side enforcement
exists; the button working today doesn't mean the access rule you expect is actually there.

| Method & Path | Access | Request Body | Success Response |
|---|---|---|---|
| `POST /api/documents` | `ROLE_ADMIN` only | Full `Document` JSON, persisted verbatim including `verificationStatus` - this is metadata-only, no file upload (use §3.3's multipart endpoint for real uploads) | `201` created `Document`. |
| `GET /api/documents/{id}` | **No access restriction (gap, see above)** | none | `200` `Document`. `404` (JSON) if not found. |
| `GET /api/documents` | **No access restriction (gap, see above)** | none | `200` `Document[]` - every document in the system. |
| `PUT /api/documents/{id}` | **No access restriction (gap, see above).** Also applies `verificationStatus`/`remarks`/`filePath`/`application` verbatim with zero field stripping - an applicant reaching this could self-approve their own document. Intended to become PROCESSOR/UNDERWRITER/ADMIN-only. | Partial `Document` JSON, null-safe merge | `200` updated `Document`. |
| `DELETE /api/documents/{id}` | **No access restriction (gap, see above).** Intended rule (not yet implemented): owning applicant may delete their own document only while `verificationStatus == "PENDING"`; once verified/rejected, `ROLE_ADMIN` only. | none | `204` no content. |
| `PATCH /api/documents/{documentId}` | `ROLE_PROCESSOR` only | `{ verificationStatus?: string, status?: string, remarks?: string }` - accepts either `verificationStatus` or `status` as the key (checks `verificationStatus` first, falls back to `status`); value is uppercased | `200` updated `Document`. Code has a commented-out TODO to also check the document's application against the caller - currently **any** processor can update **any** document's status regardless of whether they claimed that application. |
| `PATCH /api/documents/applications/{applicationId}/request-documents` | `ROLE_PROCESSOR` only | `{ message?: string }` (optional body) | `200` `LoanApplication` with `status = "Waiting for Documents"`; if `message` given, it's stored in `decisionComments`. **Note the URL**: despite being about an application, this lives under `/api/documents/...` (controller's base path), not `/api/applications/...` - a known oddity flagged in-code as "should move to ProcessorController". |

### 3.5 `ApplicationHistoryController` - `/api/application-history`

Updated: this section was stale (`preAuthorizeTodo.csv` tasks 10/11 landed after this doc's original
pass). Write endpoints (`POST`/`PUT`/`DELETE`) are `ROLE_ADMIN` only - not open to every authenticated
user. Reads (`GET` by id, `GET` list) are ownership-scoped via the same access-guard pattern as every
other controller: owning applicant, assigned processor/underwriter, or admin only; the list endpoint
has no `applicationId` query param, so a non-admin client gets back every entry it has access to across
*all* of its own applications and has to filter client-side.

The frontend should **not** call `POST /api/application-history` itself anymore (`featuresTodo.csv`
task 1, now done) - the backend writes history entries automatically as a side effect of these actions,
attributed to the caller: `LoanApplicationController.submitApplication()`/`withdrawApplication()`
(`action: "SUBMITTED"`/`"WITHDRAWN"`), `ProcessorController.claimApplication()`/`verifyApplication()`
(`"PROCESSOR_CLAIMED"`/`"PROCESSOR_VERIFIED"`, the latter's `details` carrying the recommendation +
reason), `UnderwriterController.claimApplication()` (`"UNDERWRITER_CLAIMED"`), and
`DocumentController.updateDocumentStatus()` (`"DOCUMENT_VERIFIED"`/`"DOCUMENT_REJECTED"`, only logged
when the resulting `verificationStatus` is exactly `VERIFIED` or `REJECTED`). `action` strings above are
this implementation's choice, not a fixed enum enforced anywhere - don't assume the set is closed.

| Method & Path | Access | Request Body | Success Response |
|---|---|---|---|
| `POST /api/application-history` | `ROLE_ADMIN` only | Full `ApplicationHistory` JSON: `{ application: {id}, user: {id}, action, details }` | `201` created entry. Manual writes are a stopgap for admin use only now that real actions log themselves automatically. |
| `GET /api/application-history/{id}` | Owning applicant / assigned processor or underwriter / admin | none | `200` entry. `403` if caller lacks access. `404` (JSON) if missing. |
| `GET /api/application-history` | Any authenticated user, results scoped to what they can access | none | `200` entries the caller has access to (own applications for an applicant, assigned/claimed for staff, everything for admin) - no `applicationId` query param, filter client-side. |
| `PUT /api/application-history/{id}` | `ROLE_ADMIN` only | Partial JSON, null-safe merge (same pattern as other update methods - check `ApplicationHistoryService` if you need exact merge semantics) | `200` updated entry. |
| `DELETE /api/application-history/{id}` | `ROLE_ADMIN` only | none | `204` no content. |

### 3.6 `ProcessorController` - `/api/processor`

| Method & Path | Access | Request Body | Success Response |
|---|---|---|---|
| `GET /api/processor/work-list` | `ROLE_PROCESSOR` only | none | `200` `LoanApplication[]` where `status == "Submitted"` exactly. |
| `POST /api/processor/claim/{applicationId}` | `ROLE_PROCESSOR` only. Any processor may claim any `Submitted` application (first-come-first-served, no prior-assignment check) | none | `200` `LoanApplication` with `processor` set to caller, `status = "In Review"`. `400` (returns the **unchanged** application body, not empty) if current status isn't exactly `"Submitted"`. |
| `POST /api/processor/applications/{applicationId}/verify` | `ROLE_PROCESSOR` only. **No check that the caller is the processor assigned to this application** - any processor can verify any application, claimed by them or not | none | `200` updated `LoanApplication` with `recommendation`/`recommendationReason`/`status` set by server-side rule logic (below). |

**Verify decision logic** (for frontend messaging/expectations):
- Missing any of `PAN_CARD`/`SALARY_SLIP`/`ADDRESS_PROOF` → `recommendation = "REJECTED"`, `status = "Waiting for Documents"`.
- Any uploaded document has `verificationStatus == "REJECTED"` → `recommendation = "REJECTED"`, `status = "Waiting for Documents"`.
- Otherwise, based on `creditScore` (treated as `0` if null) and `verifiedIncome`:
  - `creditScore >= 700` AND (`verifiedIncome` is null OR `>= 30000`) → `recommendation = "APPROVE"`, `status = "Ready for Underwriter"`.
  - `creditScore >= 650` → `recommendation = "MANUAL_REVIEW"`, `status = "Ready for Underwriter"`.
  - else → `recommendation = "REJECT"` *(no trailing "ED", inconsistent with the "REJECTED" used in the two branches above - frontend must handle both spellings)*, `status = "Ready for Underwriter"` *(yes, even the low-credit-score rejection path still moves to "Ready for Underwriter", not a rejected/closed state - there's no terminal rejection status, see §7)*.

### 3.7 `UnderwriterController` - `/api/underwriter`

| Method & Path | Access | Request Body | Success Response |
|---|---|---|---|
| `GET /api/underwriter/work-list` | `ROLE_UNDERWRITER` only | none | `200` `LoanApplication[]` where `status == "Ready for Underwriter"` exactly. |
| `POST /api/underwriter/claim/{applicationId}` | `ROLE_UNDERWRITER` only. Any underwriter may claim any `Ready for Underwriter` application, no prior-assignment check | none | `200` `LoanApplication` with `underwriter` set to caller, `status = "In Underwriting Review"`. `400` (returns unchanged application body) if status isn't exactly `"Ready for Underwriter"`. |

**There is no underwriter decision endpoint.** Once an application is `"In Underwriting Review"`, the
only way to set `decision`/`decisionComments`/a final status is the generic `PUT /api/applications/{id}`
(§3.3), which as an assigned underwriter you do have access to. There is no defined set of terminal
`decision` values yet - decide this with the team before wiring up an "Approve/Reject" button; whatever
strings you pick are not currently read or validated by anything server-side.

### 3.8 `AdminController` - `/api/admin`

| Method & Path | Access | Request Body | Success Response |
|---|---|---|---|
| `PATCH /api/admin/users/{id}/role` | `ROLE_ADMIN` only. Cannot target the caller's own account with a different role (same rule as §3.2's `PUT /api/users/{id}`) | `{ role: string }` - must be one of `ROLE_USER`, `ROLE_PROCESSOR`, `ROLE_UNDERWRITER`, `ROLE_ADMIN` | `200` updated `User` (only `role` changes - unlike `PUT /api/users/{id}`, no other field can be touched through this endpoint even if included in the body). `400` for an unknown/blank role or a self-role-change attempt. `404` if the target id doesn't exist. |

This is the recommended way to promote/demote a user going forward - prefer it over `PUT /api/users/{id}`
(§3.2) when a role change is all you need, since that endpoint's full-entity body shape makes it easy to
accidentally also send (and overwrite) email/name/password fields in the same call.

---

## 4. Quick access-control summary

| Role | Can do |
|---|---|
| `ROLE_USER` (applicant) | Register/login/own profile. Create/view/edit-while-Draft/submit/withdraw **their own** applications only. Upload documents to any application id (gap, §3.3). View/edit/delete any document (gap, §3.4). Read (not write) their own applications' history entries - writes are `ROLE_ADMIN` only (§3.5). |
| `ROLE_PROCESSOR` | Everything a normal authenticated user can reach via the gaps above, **plus** work-list/claim/verify/request-documents/update-document-status under `/api/processor` and `/api/documents`. Sees only applications where they're the assigned processor via `GET /api/applications` (list is scoped), but can still read/write *any* application by id directly since `/api/documents/*` aren't ownership-checked (application-history reads *are* ownership-scoped, §3.5). |
| `ROLE_UNDERWRITER` | Same pattern as processor, for `/api/underwriter` work-list/claim. No dedicated decision endpoint (§3.7). |
| `ROLE_ADMIN` | Full access everywhere: only role that can create/list/delete users, delete applications, create/update/delete documents/history entries directly, and assign roles via the dedicated `PATCH /api/admin/users/{id}/role` (§3.8). Cannot create a loan application via `POST /api/applications` (role check is literally `hasRole('USER')`, not "not staff"), and cannot change their own role even via this dedicated endpoint. |

---

## 5. Known frontend/backend mismatches (from `todo/frontendContractTodo.csv`)

If you're porting an existing frontend rather than building fresh, these are already-identified gaps:
- `POST /api/documents/upload` does not exist. Use `POST /api/applications/{id}/documents` (multipart).
- No file-download/view route exists anywhere - uploaded files sit on disk under `uploads/applications/{id}/`
  with nothing to stream them back to a client. Don't build a "view document" button yet.
- Status strings must be the exact capitalized backend values (`"Draft"`, `"Submitted"`, `"In Review"`,
  `"Waiting for Documents"`, `"Ready for Underwriter"`, `"In Underwriting Review"`, `"Withdrawn"`) -
  lowercase/hyphenated equivalents will silently fail exact-match filters.
- There's no fixed set of underwriter decision strings server-side (see §3.7) - don't hardcode
  `approved`/`rejected`/`referred` without confirming what gets stored where.

## 6. What to build against safely today

- Auth: login/register/me/change-password (§3.1).
- Applicant flow: create → edit while Draft → upload documents → submit → view own application(s)/status.
- Processor flow: work-list → claim → verify.
- Underwriter flow: work-list → claim (decision step needs a design decision first, see §3.7).
- Admin: user CRUD, application delete.

## 7. What's explicitly unfinished (don't design final UX around these yet)

- Refresh tokens (`missingEndpoint.csv`): not implemented by design - single long-lived (1h) access token.
- Forgot/reset password, email verification (`missingEndpoint.csv`): "Will Implement Later", no backend support at all.
- Document ownership checks (§3.4): still wide open to any authenticated user (`DocumentController.update`
  and the per-document `PATCH .../{documentId}` status endpoint have no assigned-processor check yet).
  Application-history ownership (§3.5) is already locked down, and history now writes itself automatically.
- Underwriter decision endpoint (§3.7): doesn't exist; only the generic PUT is available.
- Document download/view and a correctly-named upload route (§5).
