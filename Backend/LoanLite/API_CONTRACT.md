# LoanLite API Contract

Generated from the actual controller/entity/security code, most recently revised 2026-08-23 after
`todo/featuresTodo.csv`'s full 11-task backlog landed (automatic history, admin role assignment, fixed
interest rate + EMI, status-flow rework, claim-race fix, field-stripping on update, document-status
ownership, exception-message-leak fix, upload limits, pagination) and a full audit pass against the
current code. This describes **what the backend does today**, including known gaps - it is not an
aspirational spec. Gaps are called out explicitly so the frontend doesn't build against protections
that don't exist yet.

See also, in the repo root: `missingEndpoint.csv` (auth endpoints not implemented), `todo/preAuthorizeTodo.csv`
(access-control lockdown - all items Done except one deliberately deferred bean-validation task),
`todo/frontendContractTodo.csv` (known frontend/backend mismatches found so far).

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
| `IllegalArgumentException` | 400 | e.g. duplicate email (create **and** update, `featuresTodo.csv` task 9), wrong current password |
| `MethodArgumentNotValidException` (`@Valid` binding failure) | 400 | `backendTodo.csv` task 7, "Done" - `message` is every failing field joined with `; `, e.g. `"loanAmount: must be at least 50000; tenureMonths: tenureMonths must be one of 12, 24, 36, 48, 60"` |
| `IllegalStateException` | 404 | used by `AuthController`'s "authenticated user not found" checks |
| `RuntimeException` whose message contains `"not found"` (case-insensitive) | 404 | this is how every service reports "no such id" - there's no dedicated `NotFoundException` type |
| any other `RuntimeException` | 500 | `message` is a generic `"An unexpected error occurred."`, **not** the real exception text (`featuresTodo.csv` task 9, "Done") - the real message is logged server-side only. Was previously the raw `ex.getMessage()`, which could leak SQL constraint text, NPE internals, or file paths. |
| anything else | 500 | same generic-message treatment as above |
| no/invalid/expired JWT on a protected route | 401 | via `HttpStatusEntryPoint` |

Every other status above (400/401/403/404) still returns the real `ex.getMessage()` in the body -
those messages are deliberately written to be client-facing (e.g. `"email already in use"`,
`"Loan application not found with id: 99"`). Only the generic-500 fallback had its message replaced,
since that's the only case where the underlying exception type (and therefore its message content)
isn't controlled by this codebase.

**Manual ownership/precondition checks** (`backendTodo.csv` task 3, "Done") now throw a dedicated
`ApiException(HttpStatus, message)` instead of returning an empty body - every 403/404/400 that used to
come from an `if` check in a controller (`ResponseEntity.status(X).build()` / `.notFound().build()` /
`.badRequest().build()`) is handled by the same `GlobalExceptionHandler` and returns the identical JSON
shape above, with a real client-facing message. This fixed all 22 previously-empty-body call sites
across every controller (see §4) - there is no longer a code path in this API that returns a non-2xx
response with an empty body. `AuthController.changePassword()`'s wrong-current-password/blank-new-password
case also changed from a manually-caught bare 400 to simply letting the existing `IllegalArgumentException`
propagate to its usual handler.

**Pagination** (`featuresTodo.csv` task 11, "Done") - six list-returning endpoints now accept Spring
Data's standard `page`/`size`/`sort` query params (`?page=0&size=20&sort=id,desc`) and return
**Spring Data's `Page<T>` JSON envelope** instead of a bare array:
```json
{
  "content": [ /* the actual T[] for this page */ ],
  "totalElements": 137,
  "totalPages": 7,
  "size": 20,
  "number": 0,
  "first": true,
  "last": false,
  "numberOfElements": 20,
  "empty": false
}
```
**This is a breaking response-shape change** - anywhere the frontend previously read these endpoints'
responses as a bare `T[]`, it now needs to read `response.content` instead. Default page size is **20**
when no `size` param is given (`@PageableDefault(size = 20)`); there's no server-side maximum enforced,
so a client requesting a very large `size` gets it. The six affected endpoints:
`GET /api/applications` (§3.3), `GET /api/documents` (§3.4), `GET /api/application-history` (§3.5),
`GET /api/users` (§3.2), `GET /api/processor/work-list`, `GET /api/underwriter/work-list` (§3.6/§3.7).
`GET /api/documents` and `GET /api/application-history` also had their ownership filtering moved from a
post-fetch Java `Stream.filter()` over every row in the table into the query itself (a single `@Query`
per repository, shared between admin and non-admin callers) - functionally equivalent access rules,
just no longer fetching unbounded data before paging and filtering.

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
    (§3.3, `GET /api/applications/{id}/documents`).

### User
```ts
{
  id: number,
  email: string,           // required, must be a valid email address on create - enforced only where @Valid is wired (POST /api/users, POST /api/auth/register), not on PUT /api/users/{id} (partial merge, backendTodo.csv task 7)
  passwordHash: string,   // BCrypt hash on read; raw password expected on write (see below)
  firstName: string,       // required on create, same @Valid scope as email above
  lastName: string,        // required on create, same @Valid scope as email above
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
  loanAmount: number | null,        // BigDecimal - required, 50000-2500000 (backendTodo.csv task 7, "Done") on create; validated on update() only when present in the request body (partial merge)
  tenureMonths: number | null,      // required, must be exactly one of 12/24/36/48/60 (a discrete set, not a range) on create; same partial-update validation as loanAmount
  declaredIncome: number | null,    // BigDecimal - required, must be > 0 on create; same partial-update validation as loanAmount
  verifiedIncome: number | null,    // BigDecimal - auto-populated at processor claim time (§3.6, backendTodo.csv task 5), staff can still override via PUT
  creditScore: number | null,       // auto-populated at processor claim time (§3.6, backendTodo.csv task 5), staff can still override via PUT
  interestRate: number | null,      // BigDecimal - fixed backend constant (currently 12), forced on every create/update regardless of input; never send this from a client
  emi: number | null,               // BigDecimal - computed server-side (standard EMI formula, 2dp HALF_UP) from loanAmount/tenureMonths/interestRate on every create/update; forced, never accept this from a client
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
  verificationStatus: string,  // free text, uppercased. "PENDING" is set automatically on upload. All three of PENDING/VERIFIED/REJECTED are specifically handled: ProcessorController.verifyApplication() (featuresTodo.csv task 5) requires every required document to be exactly "VERIFIED" - PENDING and REJECTED both block verification the same way. DocumentController.delete() also checks for exactly "PENDING" to decide whether the owning applicant may delete it themselves (§3.4).
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
`Draft` → `Submitted` → `Under Verification` (processor claims) → `Verified` (processor verify
succeeds) → `Under Review` (underwriter claims) → `Accepted` *or* `Rejected` (underwriter decision,
§3.7 - the terminal states). `Withdrawn` is a terminal state set by the applicant at any time
before/during the above via withdraw. There is no `"Waiting for Documents"` status triggered by
verification failure (`featuresTodo.csv` task 5) - if verification can't proceed,
`POST /api/processor/applications/{id}/verify` returns `400` with a reason instead of changing
status; the application just stays `Under Verification`. A **narrower, differently-triggered**
`"Waiting for Documents"` status DOES exist (`backendTodo.csv` task 8, "Done") - it's set only by
`PATCH /api/documents/applications/{id}/request-documents` (§3.4), purely a cosmetic status string
with no functional/access/query difference from `Under Verification` (same ownership, same
`GET /api/applications` scoping, same everything) - it auto-reverts back to `Under Verification`
once every required document type has at least one non-`REJECTED` upload again (§3.4). Matching is
exact-string, case-sensitive in search/filter queries (`l.status = :status` in JPQL) -
`"submitted"` will not match `"Submitted"`.

---

## 3. Endpoint reference by controller

Legend for **Access**: role required by `@PreAuthorize`, plus any additional ownership/ business
rule enforced manually in the method body (these do **not** show up as an annotation - they're plain
`if` checks against `LoanApplicationAccessGuard`).

### 3.1 `AuthController` - `/api/auth`

| Method & Path | Access | Request Body | Success Response |
|---|---|---|---|
| `POST /api/auth/login` | Public | `{ email, password }` (`AuthRequest`) | `200` `{ tokenType: "Bearer", token: string }` (`AuthResponse`). Throws `AuthenticationException` → 401 on bad credentials. |
| `POST /api/auth/register` | Public | `{ email, password, firstName, lastName }` (`RegisterRequest`) - all four required, `email` must be a valid address, `password` must be at least 8 characters (`backendTodo.csv` task 7, "Done", `@Valid`-enforced - `400` with a field-level message on violation) | `201` `UserResponse` (`{ id, email, firstName, lastName, role }`) - **does not log the user in**, frontend must call `/login` separately afterward. Always creates with `role = ROLE_USER`. `password` here is stored as-is into `passwordHash` and then BCrypt-encoded server-side. Duplicate email → 400 `"email already in use"`. |
| `POST /api/auth/logout` | Public | none | `200` empty body. Pure no-op; no server state changes. |
| `GET /api/auth/me` | Any authenticated user (explicit `@PreAuthorize("isAuthenticated()")`) | none | `200` `UserResponse` for the caller. |
| `POST /api/auth/change-password` | Any authenticated user (same explicit `@PreAuthorize("isAuthenticated()")`) | `{ currentPassword, newPassword }` (`ChangePasswordRequest`) | `200` empty body. `400` (JSON error shape, `backendTodo.csv` task 3 - was previously a bare empty-body 400 from a manually-caught `IllegalArgumentException`) if `currentPassword` is wrong or `newPassword` is blank. |

### 3.2 `UserController` - `/api/users`

| Method & Path | Access | Request Body | Success Response |
|---|---|---|---|
| `POST /api/users` | `ROLE_ADMIN` only | Full `User` JSON: `{ email, passwordHash /* plaintext in, hash out */, firstName, lastName, phone, role }` - `email`/`firstName`/`lastName` required, `email` must be a valid address (`backendTodo.csv` task 7, "Done", `@Valid`-enforced) | `201` created `User` (raw entity, includes `passwordHash`). |
| `GET /api/users/{id}` | Any authenticated user, **plus**: caller must be `ROLE_ADMIN` **or** `caller.email == target.email` | none | `200` `User`. `403` (JSON error shape) if neither condition holds. |
| `GET /api/users` | `ROLE_ADMIN` only | none, optional `page`/`size`/`sort` (§1 Pagination) | `200` `Page<User>` (§1) - every user in the system, including `passwordHash`, paginated, default size 20. |
| `PUT /api/users/{id}` | Any authenticated user, **plus** same admin-or-self rule as `GET /{id}` | Full `User` JSON (any field null-safe partial update - only non-null fields overwrite) | `200` updated `User`. `403` (JSON error shape) if not admin/self. **`400`** (via `IllegalArgumentException` → global handler) if the caller targets **their own account** and sends a `role` different from their current one - this applies to admins too (self-role-change is blocked for everyone, not just non-admins - a prior version of this doc got that backwards). **`400`** also if `email` is set to a value already in use by a *different* user (`featuresTodo.csv` task 9, "Done") - mirrors `POST /api/users`' existing duplicate-email check; before this, a duplicate email hit the database's unique constraint directly and leaked a raw `500`. For a minimal, dedicated way to change *someone else's* role, prefer `PATCH /api/admin/users/{id}/role` (§3.8) over this full-entity endpoint. |
| `DELETE /api/users/{id}` | `ROLE_ADMIN` only | none | `204` no content. |

### 3.3 `LoanApplicationController` - mounted at **both** `/api/loan-applications` and `/api/applications` (identical routes on either prefix)

| Method & Path | Access | Request Body | Success Response |
|---|---|---|---|
| `POST /api/applications` | `ROLE_USER` only (`@PreAuthorize`) - **note: admins cannot create an application through this endpoint**, only plain applicants can | `LoanApplication` JSON. `applicant`, `status`, `recommendation`, `recommendationReason`, `decision`, `decisionComments`, `processor`, `underwriter`, `creditScore`, `verifiedIncome` are all silently overwritten/forced to `null`/`Draft`/caller regardless of what you send. `interestRate` and `emi` are likewise always server-computed (fixed rate + the standard EMI formula off `loanAmount`/`tenureMonths`) regardless of what you send - don't let a client collect either as user input. `createdAt`/`updatedAt`/`submittedAt` are also force-nulled on every create (`backendTodo.csv` task 2, "Done") - `createdAt`/`updatedAt` always come out as the server's current time, `submittedAt` always comes out `null` regardless of what's sent. Only `applicationNumber` (auto-generated if blank), `loanAmount`, `tenureMonths`, `declaredIncome` are actually honored from the body - all three are now `@Valid`-enforced (`backendTodo.csv` task 7, "Done"): `loanAmount` required, 50000-2500000; `tenureMonths` required, must be exactly one of 12/24/36/48/60 (a discrete set, not a range); `declaredIncome` required, must be > 0. `400` with a field-level message (e.g. `"loanAmount: must be at least 50000; tenureMonths: tenureMonths must be one of 12, 24, 36, 48, 60"`) on violation - **note**: since `@Valid` runs during Spring MVC argument resolution, which happens before `@PreAuthorize`'s AOP interceptor, a non-`ROLE_USER` caller sending an invalid body gets `400` instead of the usual `403` (the request is still rejected either way, just with a different status). | `201` created `LoanApplication`. |
| `GET /api/applications` | Any authenticated user. Query params `status`, `processorId`, `underwriterId`, `applicantId` all optional. **Non-admins are force-scoped**: an applicant's `applicantId` is always overridden to their own id (any value they pass is ignored); a processor's `underwriterId`/applicant filters are ignored and `processorId` is forced to their own id; underwriter likewise forced to their own `underwriterId`. Admins' params pass through unchanged (including seeing everything if no params given). | none, optional `page`/`size`/`sort` (§1 Pagination) | `200` `Page<LoanApplication>` (§1), filtered by exact-match AND of whichever params end up set, paginated, default size 20. The dynamic filter query was rewritten as a `Specification` (`featuresTodo.csv` task 11, "Done") to compose with pagination - same filtering semantics as before. |
| `GET /api/applications/{id}` | Any authenticated user, **plus** `LoanApplicationAccessGuard.hasAccess`: owning applicant OR assigned processor OR assigned underwriter OR admin | none | `200` `LoanApplication`. `403` (JSON error shape) otherwise. `404` (JSON error shape) if id doesn't exist. |
| `GET /api/applications/application-number/{applicationNumber}` | Same access rule as above | none | `200` `LoanApplication`. `404` (JSON error shape, `backendTodo.csv` task 3 - was previously an empty body via `ResponseEntity.notFound()`) if no such application number. `403` (JSON error shape) if found but caller lacks access. |
| `PUT /api/applications/{id}` | Same `hasAccess` rule as GET, **plus**: if caller is specifically the owning applicant, the application's current `status` must still be `Draft` (else `403`, JSON error shape), the incoming `status` field is force-nulled (ignored) even in Draft - applicants can never change status via this endpoint, only via submit/withdraw - and (`featuresTodo.csv` task 7, "Done") `recommendation`/`recommendationReason`/`decision`/`decisionComments`/`processor`/`underwriter`/`creditScore`/`verifiedIncome` are all force-copied back from the application's current (pre-update) values, silently discarding any caller-supplied changes to them - closing the same forgery risk `create()` already blocks, e.g. an applicant can no longer plant a favorable `creditScore` before submitting to influence the processor's auto-recommendation. Staff (assigned processor/underwriter) and admin can update at any status **and these 8 fields** with no extra restriction - the stripping is owning-applicant-only. `interestRate` is force-set to the fixed backend rate for **every** caller here too, staff and admin included, and `emi` is always recomputed server-side from the (post-merge) `loanAmount`/`tenureMonths`/`interestRate` - a partial update that only changes `tenureMonths` still gets a correctly recomputed `emi`, not a stale one. Neither field is honored from any request body, regardless of role. `loanAmount`/`tenureMonths`/`declaredIncome` are validated against the same rules as `create()` (`backendTodo.csv` task 7, "Done") **but only when that specific field is present in the request body** - `@Valid` isn't used here since this endpoint is an intentional partial merge (a legitimate update that doesn't touch, say, `tenureMonths` shouldn't fail because `tenureMonths` "is required"); a violating field present in the body gets `400` via the standard JSON error shape. | Partial `LoanApplication` JSON - only non-null fields in the body overwrite existing values (service does a manual null-check merge, not a full replace) | `200` updated `LoanApplication`. |
| `PATCH /api/applications/submit/{id}` | Owning applicant only (`isOwningApplicant`) - **no staff/admin override at all**, even admin gets 403 | none | `200` `LoanApplication` with `status = "Submitted"` and `submittedAt` set (if not already). `403` (JSON error shape) for anyone but the owner. |
| `PATCH /api/applications/withdraw/{id}` | Owning applicant only, same as submit - no staff/admin override | none | `200` `LoanApplication` with `status = "Withdrawn"`. `403` (JSON error shape) otherwise. |
| `POST /api/applications/{id}/documents` | No `@PreAuthorize`, but **ownership-checked via `accessGuard.hasAccess()`**: owning applicant, assigned processor/underwriter, or admin only (this doc previously claimed there was no check at all - that was stale/incorrect, predating `featuresTodo.csv`) | `multipart/form-data`: `file` (required), `documentType` (optional, default `"OTHER"`), `remarks` (optional) | `201` created `Document`. `403` (JSON error shape) if caller lacks access. `400` (JSON error shape) if `file` missing/empty. `400` (JSON, via `IllegalArgumentException`) if `file`'s content-type isn't one of `application/pdf`/`image/jpeg`/`image/png` (`featuresTodo.csv` task 10, "Done") - **note**: this checks the client-supplied content-type header, not the file's actual bytes, so it's a cheap first barrier, not a guarantee against a deliberately mislabeled upload. `400` (JSON, via a dedicated handler, not a raw framework message) if the file exceeds `spring.servlet.multipart.max-file-size` (5MB) or the request exceeds `max-request-size` (20MB, covers all 3 required docs plus headroom). If the application's current `status` is `"Waiting for Documents"` and this upload brings every required type (`PAN_CARD`/`SALARY_SLIP`/`ADDRESS_PROOF`) to having at least one non-`REJECTED` document, `status` is automatically set back to `"Under Verification"` and a `"DOCUMENTS_RESUBMITTED"` history entry is logged (`backendTodo.csv` task 8, "Done") - a `REJECTED` document of a type doesn't block this as long as another `PENDING`/`VERIFIED` document of that same type also exists. |
| `GET /api/applications/{id}/documents` | **Also ownership-checked via `accessGuard.hasAccess()`**, same rule as the upload endpoint above (this doc previously claimed there was no check here either - also stale/incorrect) | none | `200` `{ documents: Document[], missingRequiredDocuments: string[] }` - the latter is whichever of `PAN_CARD`/`SALARY_SLIP`/`ADDRESS_PROOF` hasn't been uploaded yet. `403` (JSON error shape) if caller lacks access. |
| `DELETE /api/applications/{id}` | `ROLE_ADMIN` only | none | `204` no content. Hard delete, no status guard. |

### 3.4 `DocumentController` - `/api/documents`

**Corrected: this section previously described a stale, already-fixed state.** `preAuthorizeTodo.csv`
tasks 9/9b/9c/9d (locking down `get`/`create`/`update`/`delete` respectively) are all marked **"Done"**
in that CSV, and the code confirms it - none of the four are an open gap anymore:
- `get` (`GET /api/documents/{id}`) - ownership-checked via `accessGuard.hasAccess()`.
- `create` (`POST /api/documents`) - `ROLE_ADMIN` only.
- `update` (`PUT /api/documents/{id}`) - role-gated to `PROCESSOR`/`UNDERWRITER`/`ADMIN`, **plus**
  (`todo/backendTodo.csv` task 1, "Done") an assigned-processor/assigned-underwriter ownership check -
  admin has no such restriction.
- `delete` (`DELETE /api/documents/{id}`) - admin, or the owning applicant but only while
  `verificationStatus == "PENDING"`.

`list` (`GET /api/documents`) has no `@PreAuthorize` role gate, but its query is scoped server-side to
what the caller can see (own applications for an applicant, assigned/claimed for staff, everything for
admin), added as part of `featuresTodo.csv` task 11's pagination rewrite. `updateDocumentStatus` and
`requestDocuments` have their own dedicated ownership checks, documented in their own rows below.

| Method & Path | Access | Request Body | Success Response |
|---|---|---|---|
| `POST /api/documents` | `ROLE_ADMIN` only | Full `Document` JSON, persisted verbatim including `verificationStatus` - this is metadata-only, no file upload (use §3.3's multipart endpoint for real uploads) | `201` created `Document`. |
| `GET /api/documents/{id}` | Ownership-checked via `accessGuard.hasAccess()` on the document's application: owning applicant, assigned processor/underwriter, or admin only | none | `200` `Document`. `403` (JSON error shape) if caller lacks access. `404` (JSON error shape) if not found. |
| `GET /api/documents` | No `@PreAuthorize`, but **scoped server-side to what the caller can see** (own applications for an applicant, assigned/claimed for staff, everything for admin) via a single query (`featuresTodo.csv` task 11, "Done") - previously fetched every row via `findAll()` then filtered with a Java stream, which didn't compose with pagination | none, optional `page`/`size`/`sort` (§1 Pagination) | `200` `Page<Document>` (§1), paginated, default size 20. |
| `PUT /api/documents/{id}` | `PROCESSOR`/`UNDERWRITER`/`ADMIN` only (`@PreAuthorize`), **plus** (`backendTodo.csv` task 1, "Done") an assigned-processor/assigned-underwriter ownership check on the document's application - `403` for staff not assigned to it; admin has no such restriction. Also applies `verificationStatus`/`remarks`/`filePath`/`application` verbatim with zero field stripping. An applicant can never reach this endpoint at all (blocked by the role gate before the method body runs) - they upload via `POST /api/applications/{id}/documents` instead. | Partial `Document` JSON, null-safe merge | `200` updated `Document`. `403` (JSON error shape) for `ROLE_USER` callers, or for a processor/underwriter not assigned to the document's application. |
| `DELETE /api/documents/{id}` | Admin, or the owning applicant but only while `verificationStatus == "PENDING"` - stops an applicant from erasing a `REJECTED` document and re-triggering verification as if it never existed | none | `204` no content. `403` (JSON error shape) otherwise. |
| `PATCH /api/documents/{documentId}` | `ROLE_PROCESSOR` only, **plus** an assigned-processor ownership check (`403` for a processor not assigned to that document's application, `featuresTodo.csv` task 8, "Done") - closes what used to be a real gap: any processor could previously flip any document's status on any application system-wide | `{ verificationStatus?: string, status?: string, remarks?: string }` - accepts either `verificationStatus` or `status` as the key (checks `verificationStatus` first, falls back to `status`); value is uppercased | `200` updated `Document`. `403` (JSON error shape) if the caller isn't the assigned processor. `404` (JSON error shape) if the document doesn't exist. |
| `PATCH /api/documents/applications/{applicationId}/request-documents` | `ROLE_PROCESSOR` only, **plus** assigned-processor ownership check (`403` for an unassigned processor) - added alongside task 5, closing the same gap `verify()` had | `{ message?: string }` (optional body) | `200` `LoanApplication` with `status` set to `"Waiting for Documents"` (`backendTodo.csv` task 8, "Done") - purely a cosmetic status string for the applicant-facing UI, no functional/access/query difference from `Under Verification`; if `message` given, it's stored in `decisionComments` and also logged as a `DOCUMENTS_REQUESTED` history entry. Reverts back to `"Under Verification"` automatically the next time the applicant uploads a document that completes the required set (see `POST /api/applications/{id}/documents` below) - logs a `"DOCUMENTS_RESUBMITTED"` history entry when that happens. **Note the URL**: despite being about an application, this lives under `/api/documents/...` (controller's base path), not `/api/applications/...` - a known oddity flagged in-code as "should move to ProcessorController". |

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
reason), `UnderwriterController.claimApplication()`/`decideApplication()`/`returnToProcessor()`
(`"UNDERWRITER_CLAIMED"`, `"UNDERWRITER_ACCEPTED"`/`"UNDERWRITER_REJECTED"` from the decision endpoint,
and `"UNDERWRITER_RETURNED"` from the return-to-processor endpoint, §3.7 - the latter added by
`backendTodo.csv` task 4), `DocumentController.updateDocumentStatus()`
(`"DOCUMENT_VERIFIED"`/`"DOCUMENT_REJECTED"`, only logged when the resulting `verificationStatus` is
exactly `VERIFIED` or `REJECTED`), `DocumentController.requestDocuments()` (`"DOCUMENTS_REQUESTED"`,
§3.4), and `LoanApplicationController.uploadDocument()` (`"DOCUMENTS_RESUBMITTED"`, §3.3 - only
logged when an upload completes the required set and auto-reverts `"Waiting for Documents"` back to
`"Under Verification"`, `backendTodo.csv` task 8). `action` strings above are this implementation's
choice, not a fixed enum enforced anywhere - don't assume the set is closed.

| Method & Path | Access | Request Body | Success Response |
|---|---|---|---|
| `POST /api/application-history` | `ROLE_ADMIN` only | Full `ApplicationHistory` JSON: `{ application: {id}, user: {id}, action, details }` | `201` created entry. Manual writes are a stopgap for admin use only now that real actions log themselves automatically. |
| `GET /api/application-history/{id}` | Owning applicant / assigned processor or underwriter / admin | none | `200` entry. `403` (JSON error shape) if caller lacks access. `404` (JSON error shape) if missing. |
| `GET /api/application-history` | Any authenticated user, results scoped to what they can access via a single query (`featuresTodo.csv` task 11, "Done" - previously fetched every row then filtered with a Java stream) | none, optional `page`/`size`/`sort` (§1 Pagination) | `200` `Page<ApplicationHistory>` (§1) of entries the caller has access to (own applications for an applicant, assigned/claimed for staff, everything for admin), paginated, default size 20 - no `applicationId` query param, filter client-side within the page. |
| `PUT /api/application-history/{id}` | `ROLE_ADMIN` only | Partial JSON, null-safe merge (same pattern as other update methods - check `ApplicationHistoryService` if you need exact merge semantics) | `200` updated entry. |
| `DELETE /api/application-history/{id}` | `ROLE_ADMIN` only | none | `204` no content. |

### 3.6 `ProcessorController` - `/api/processor`

| Method & Path | Access | Request Body | Success Response |
|---|---|---|---|
| `GET /api/processor/work-list` | `ROLE_PROCESSOR` only | none, optional `page`/`size`/`sort` (§1 Pagination) | `200` `Page<LoanApplication>` (§1) where `status == "Submitted"` exactly, paginated, default size 20. |
| `POST /api/processor/claim/{applicationId}` | `ROLE_PROCESSOR` only. Any processor may claim any `Submitted` application, first-come-first-served (`featuresTodo.csv` task 6, "Done") | none | `200` `LoanApplication` with `processor` set to caller, `status = "Under Verification"`. Also runs the two "outside checks" (`backendTodo.csv` task 5, "Done") - two separate calls to random.org's integer-generator API (`https://www.random.org/integers/`, plain-text response, one integer per call) stand in for the charter's real credit/income check services: one with `min=300&max=900` populating `creditScore`, one with `min=10000&max=100000` populating `verifiedIncome`. Each call is independent - if one fails/times out, only that field is left `null` (falls back to manual entry via `PUT /api/applications/{id}`, same as before this task); the claim itself is never blocked or delayed-out by this dependency. Not re-run on a `backendTodo.csv` task 4 return-to-processor (that path skips `claim()` entirely, the original outside-check result stands). The `PROCESSOR_CLAIMED` history entry's `details` now also states the outcome (`"...Outside checks: creditScore=X, verifiedIncome=Y."` or `"unavailable, manual entry required"` per field). `409` (returns the **current** application body, whatever it now is) if the current status isn't exactly `"Submitted"` at the moment of the write - this covers both "someone else claimed it first" and "a genuinely stale/wrong-state attempt", since the underlying atomic conditional `UPDATE ... WHERE status = ?` can't tell those apart and doesn't need to. |
| `POST /api/processor/applications/{applicationId}/verify` | `ROLE_PROCESSOR` only, **plus** an assigned-processor ownership check (`403` for an unassigned processor, checked before any of the document/recommendation logic below) | none | `200` updated `LoanApplication` with `recommendation`/`recommendationReason`/`status = "Verified"` set by server-side rule logic (below). `400` (via `IllegalArgumentException` → global handler, listing exactly which required document types are the problem) if verification can't proceed - status is left unchanged (still `Under Verification`) in that case, there's no more `"Waiting for Documents"` status to fall into. |

**Verify decision logic** (for frontend messaging/expectations):
- Every one of `PAN_CARD`/`SALARY_SLIP`/`ADDRESS_PROOF` must have an uploaded document whose `verificationStatus` is exactly `"VERIFIED"` (set via the per-document `PATCH /api/documents/{documentId}`, PROCESSOR only) - missing entirely, still `PENDING`, or `REJECTED` all equally block verification with `400`. This is stricter than it used to be: previously any non-`REJECTED` status (including `PENDING`) was accepted.
- Once every required document is individually `VERIFIED`, the recommendation is based on `creditScore` (treated as `0` if null) and `verifiedIncome`, and `status` becomes `"Verified"` in all three cases below:
  - `creditScore >= 700` AND (`verifiedIncome` is null OR `>= 30000`) → `recommendation = "APPROVE"`.
  - `creditScore >= 650` → `recommendation = "MANUAL_REVIEW"`.
  - else → `recommendation = "REJECT"` *(no trailing "ED", inconsistent with the "REJECTED" used for the document-blocking 400 case above - frontend must handle both spellings)* - **this is not a terminal rejection**, the application still moves to `"Verified"` and can proceed to underwriter review; the actual accept/reject decision only happens at §3.7's decision endpoint.
- **Debt-to-income downgrade** (added 2026-08-24, at the user's request): after the credit-score tier
  above is picked, if the recommendation isn't already `REJECT` and `emi / declaredIncome > 0.50` (50%,
  `ProcessorController.EMI_TO_INCOME_DOWNGRADE_THRESHOLD`), the recommendation is downgraded by exactly
  one step (`APPROVE` → `MANUAL_REVIEW`, `MANUAL_REVIEW` → `REJECT`) and `recommendationReason` gets an
  appended explanation with the actual EMI/declaredIncome rupee figures in **Indian digit grouping**
  (e.g. `"₹1,77,698"`, lakhs/crores - not Western grouping like `"177,698"`; hand-rolled in
  `ProcessorController.formatInr()` since this JVM's `NumberFormat` with an `en-IN` locale was verified
  to still produce Western grouping). This is an EMI-to-income ratio, not a true multi-debt DTI - there's
  no field anywhere in this data model for the applicant's *other* existing debt obligations, so this
  loan's own computed `emi` is the closest available proxy. Divides by `declaredIncome`, **not**
  `verifiedIncome` - the latter comes from a random-number outside check (§3.6 outside checks) and isn't
  a meaningful affordability signal. This can override even a strong credit score, e.g. `creditScore=800`
  with an unaffordable EMI still gets downgraded from `APPROVE`.

### 3.7 `UnderwriterController` - `/api/underwriter`

| Method & Path | Access | Request Body | Success Response |
|---|---|---|---|
| `GET /api/underwriter/work-list` | `ROLE_UNDERWRITER` only | none, optional `page`/`size`/`sort` (§1 Pagination) | `200` `Page<LoanApplication>` (§1) where `status == "Verified"` exactly, paginated, default size 20. |
| `POST /api/underwriter/claim/{applicationId}` | `ROLE_UNDERWRITER` only. Any underwriter may claim any `Verified` application, first-come-first-served (`featuresTodo.csv` task 6, "Done") | none | `200` `LoanApplication` with `underwriter` set to caller, `status = "Under Review"`. `409` (returns the current application body) if status isn't exactly `"Verified"` at the moment of the write - same atomic-conditional-update reasoning as the processor claim endpoint above. |
| `POST /api/underwriter/applications/{applicationId}/decision` | `ROLE_UNDERWRITER` only, **plus** an assigned-underwriter ownership check - checked **before** the status precondition below, so a non-assigned caller always gets `403` regardless of the application's current status (e.g. an underwriter who hasn't claimed it yet gets `403`, not `400`, even though the status also isn't `Under Review`) | `{ decision: "ACCEPTED" \| "REJECTED", comments?: string }` | `200` `LoanApplication` with `status = "Accepted"` or `"Rejected"`, `decision` set to the same value, `decisionComments` set from `comments` if given. `400` if the application's current `status` isn't exactly `"Under Review"` (e.g. not yet claimed, or a decision was already made - this is not re-callable once decided), or if `decision` is anything other than `ACCEPTED`/`REJECTED`. This is the actual approve/reject action for the whole product - it didn't exist before `featuresTodo.csv` task 5. Also logs a `"UNDERWRITER_ACCEPTED"`/`"UNDERWRITER_REJECTED"` history entry (§3.5) - previously undocumented. |
| `POST /api/underwriter/applications/{applicationId}/return-to-processor` | `ROLE_UNDERWRITER` only, **plus** an assigned-underwriter ownership check, same order as `decision` above (`403` before the status precondition) (`backendTodo.csv` task 4, "Done") | `{ comments?: string }` (optional body) | `200` `LoanApplication` with `status` set back to `"Under Verification"` (reused, not a new dedicated status) - the processor assignment is left untouched, the same processor who verified it gets it back. `comments` if given is stored in `decisionComments` (same field `requestDocuments()` uses for its message). `400` if the application's current `status` isn't exactly `"Under Review"`. For an underwriter who finds a fixable problem (a document that looks off, income that doesn't reconcile) rather than a reason to reject the applicant outright - previously the only two outcomes were accept/reject. Logs an `"UNDERWRITER_RETURNED"` history entry (§3.5). |

The exact request body shape above (`decision`/`comments` keys, the `ACCEPTED`/`REJECTED` values) is this
implementation's choice - the original task description left it as "e.g." - not something confirmed
against an external spec, unlike the status names themselves which were explicitly agreed upfront.

### 3.8 `AdminController` - `/api/admin`

| Method & Path | Access | Request Body | Success Response |
|---|---|---|---|
| `PATCH /api/admin/users/{id}/role` | `ROLE_ADMIN` only. Cannot target the caller's own account with a different role (same rule as §3.2's `PUT /api/users/{id}`) | `{ role: string }` - must be one of `ROLE_USER`, `ROLE_PROCESSOR`, `ROLE_UNDERWRITER`, `ROLE_ADMIN` | `200` updated `User` (only `role` changes - unlike `PUT /api/users/{id}`, no other field can be touched through this endpoint even if included in the body). `400` for an unknown/blank role or a self-role-change attempt. `404` if the target id doesn't exist. |
| `GET /api/admin/stats` | `ROLE_ADMIN` only (`backendTodo.csv` task 6, "Done") | none | `200` `{ totalApplications: number, byStatus: { <status>: number, ... }, createdThisMonth: number, approvedThisMonth: number, rejectedThisMonth: number }`. `byStatus` is a full breakdown across every status value (a single `GROUP BY` query, not one `COUNT` per status), `totalApplications` is their sum. `createdThisMonth` counts by `createdAt` (precise). `approvedThisMonth`/`rejectedThisMonth` count `Accepted`/`Rejected` applications by `updatedAt` falling in the current calendar month - an **approximation**, since there's no dedicated `decidedAt` timestamp on `LoanApplication`; accurate in practice because `Accepted`/`Rejected` are terminal states nothing else normally touches afterward, but not a literal decision timestamp. Directly answers the charter's own example ("how many loans were approved this month"). |

This is the recommended way to promote/demote a user going forward - prefer it over `PUT /api/users/{id}`
(§3.2) when a role change is all you need, since that endpoint's full-entity body shape makes it easy to
accidentally also send (and overwrite) email/name/password fields in the same call.

---

## 4. Quick access-control summary

**Corrected: this table previously described a stale, already-fixed state for documents** (it wasn't
updated when `preAuthorizeTodo.csv` tasks 9/9b/9c/9d and `featuresTodo.csv` task 11 landed, even though
those tasks' own detailed rows elsewhere in this file were kept current). See §3.4 for the corrected
per-endpoint detail.

| Role | Can do |
|---|---|
| `ROLE_USER` (applicant) | Register/login/own profile. Create/view/edit-while-Draft/submit/withdraw **their own** applications only. Upload documents only to applications they have access to (ownership-checked, §3.3 - not an open gap). View/delete only their own documents, and only while `verificationStatus == "PENDING"` for delete (§3.4 - not an open gap). Cannot reach `PUT /api/documents/{id}` at all (role-gated to staff/admin). Read (not write) their own applications' history entries - writes are `ROLE_ADMIN` only (§3.5). |
| `ROLE_PROCESSOR` | Everything a normal authenticated user can reach, **plus** work-list/claim/verify/request-documents/update-document-status under `/api/processor` and `/api/documents`. Sees only applications where they're the assigned processor via `GET /api/applications` (list is scoped), and `GET /api/documents`/`GET /api/documents/{id}`/`PUT /api/documents/{id}` are all ownership-scoped (§3.4 - no longer an open gap, `backendTodo.csv` task 1). |
| `ROLE_UNDERWRITER` | Same pattern as processor, for `/api/underwriter` work-list/claim, **plus** the dedicated decision endpoint (§3.7) to accept/reject a claimed application. Same ownership scoping on `PUT /api/documents/{id}` as processor above. |
| `ROLE_ADMIN` | Full access everywhere: only role that can create/list/delete users, delete applications, create documents directly (`POST /api/documents`), create/update/delete history entries directly, and assign roles via the dedicated `PATCH /api/admin/users/{id}/role` (§3.8). **Not** exclusive on documents: `PUT /api/documents/{id}` also permits PROCESSOR/UNDERWRITER, and `DELETE /api/documents/{id}` also permits the owning applicant for their own `PENDING` document (§3.4). Cannot create a loan application via `POST /api/applications` (role check is literally `hasRole('USER')`, not "not staff"), and cannot change their own role even via the dedicated role-assignment endpoint. |

---

## 5. Known frontend/backend mismatches (from `todo/frontendContractTodo.csv`)

If you're porting an existing frontend rather than building fresh, these are already-identified gaps:
- `POST /api/documents/upload` does not exist. Use `POST /api/applications/{id}/documents` (multipart).
- No file-download/view route exists anywhere - uploaded files sit on disk under `uploads/applications/{id}/`
  with nothing to stream them back to a client. Don't build a "view document" button yet.
- Status strings must be the exact capitalized backend values (`"Draft"`, `"Submitted"`,
  `"Under Verification"`, `"Verified"`, `"Under Review"`, `"Accepted"`, `"Rejected"`, `"Withdrawn"`,
  `"Waiting for Documents"`) - lowercase/hyphenated equivalents will silently fail exact-match
  filters. The first eight were renamed in `featuresTodo.csv` task 5 (was `"In Review"`/
  `"Waiting for Documents"`/`"Ready for Underwriter"`/`"In Underwriting Review"` - that older,
  differently-triggered `"Waiting for Documents"` really was removed entirely at the time).
  `"Waiting for Documents"` was later reintroduced by `backendTodo.csv` task 8 with a narrower
  trigger (`request-documents` only, see §2/§3.4) - don't confuse the two history entries.
- The underwriter decision endpoint now exists (§3.7) with a fixed `decision` value set
  (`ACCEPTED`/`REJECTED`) - don't hardcode `approved`/`rejected`/`referred`, those aren't what gets
  stored.

## 6. What to build against safely today

- Auth: login/register/me/change-password (§3.1).
- Applicant flow: create → edit while Draft → upload documents → submit → view own application(s)/status.
- Processor flow: work-list → claim → verify.
- Underwriter flow: work-list → claim → decision (accept/reject, §3.7) or return-to-processor (§3.7) if
  something needs another look before a final decision.
- Admin: user CRUD, application delete, dashboard stats (§3.8).
- **Reminder**: every flow above that lists something (own applications, work-lists) now reads a
  paginated `Page<T>` response (§1), not a bare array - read `response.content`, not `response` itself.

## 7. What's explicitly unfinished (don't design final UX around these yet)

- Refresh tokens (`missingEndpoint.csv`): not implemented by design - single long-lived (1h) access token.
- Forgot/reset password, email verification (`missingEndpoint.csv`): "Will Implement Later", no backend support at all.
- Document download/view and a correctly-named upload route (§5).
- See `todo/backendTodo.csv` for the active backlog (timestamp forcing on create, standardized error
  shape, underwriter return-to-processor action, external credit/income check services, admin
  analytics endpoint, field-level validation).
