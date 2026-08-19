# LoanLite Project - Complete System Flow & Architecture

## 1. PROJECT OVERVIEW

**LoanLite** is a **Personal Loan Management System** that digitizes and automates the entire loan application lifecycle from application submission to final decision.

### Core Purpose:
- Streamline loan application processes
- Enable multiple stakeholders to collaborate
- Automate document verification
- Make data-driven loan decisions

---

## 2. SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
│                   (React 19.2.8 + Vite)                     │
├─────────────────────────────────────────────────────────────┤
│  - Applicant Dashboard  | Processor Dashboard               │
│  - Underwriter Dashboard | Admin Dashboard                  │
│  - Forms & Modals      | Navigation & Auth                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                    HTTP/REST API
                    (Axios Interceptors)
                         │
┌────────────────────────┴────────────────────────────────────┐
│                   API GATEWAY / SERVER                       │
│              (Port 8080 - Node.js/Spring/Django)            │
├─────────────────────────────────────────────────────────────┤
│  - Authentication & JWT Token Generation                    │
│  - User Management & Role-Based Access Control              │
│  - Loan Application Processing                              │
│  - Document Management & Verification                       │
│  - Decision Making & Audit Logging                          │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│                     DATABASE LAYER                           │
│              (MySQL/PostgreSQL/MongoDB)                     │
├─────────────────────────────────────────────────────────────┤
│  - Users Table (Role, Credentials, Profile)                │
│  - Loan Applications (Details, Status, Timeline)            │
│  - Documents (Upload, Verification Status)                  │
│  - Audit Logs (All actions & changes)                       │
│  - System Rules & Decision Criteria                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. USER ROLES & ACCESS CONTROL

### **Role 1: APPLICANT**
**What they do:** Apply for loans and track applications

**Access:**
- View Personal Dashboard
- Create new loan application
- View all own applications with status
- Upload required documents
- Track application progress in real-time

**Cannot Access:**
- Other users' applications
- Processor/Underwriter/Admin pages

---

### **Role 2: PROCESSOR**
**What they do:** Verify documents and validate applications

**Access:**
- View Processor Dashboard
- View all submitted applications (not drafts)
- Review uploaded documents
- Approve or reject documents
- Add verification notes
- Mark application as "Verified"

**Responsibility:**
- Ensure all required documents are present
- Verify document authenticity
- Check completeness of application

---

### **Role 3: UNDERWRITER**
**What they do:** Make final loan decision

**Access:**
- View Underwriter Dashboard
- View verified applications only
- See loan analysis (credit score, income verification, debt-to-income ratio)
- Make final decision: APPROVE / REJECT / REFER

**Decision Criteria:**
- Application must be verified by processor
- Based on loan rules configured in system
- Can add decision comments

---

### **Role 4: ADMIN**
**What they do:** Manage system, users, and audit trail

**Access:**
- Admin Dashboard with system statistics
- CRUD operations on users
- View audit logs of all system activities
- Configure system rules and policies
- View reports and analytics

---

## 4. AUTHENTICATION & SECURITY FLOW

### **4.1 Login Process**
```
User enters credentials
    ↓
Frontend validates input (email format, password length)
    ↓
Sends POST to /api/auth/login with {email, password}
    ↓
Backend verifies against database
    ↓
If valid → Generates JWT token (contains user ID, role, exp time)
           Returns {token, user{id, name, email, role}}
    ↓
Frontend stores in localStorage
    ↓
JWT token automatically added to ALL future API requests
    ↓
User logged in & dashboard loads based on role
```

### **4.2 JWT Token Security**
- **Token contains:** User ID, Role, Expiration Time
- **Added to headers:** `Authorization: Bearer {token}`
- **Token validation:** Backend verifies signature on every request
- **Expiration:** Auto-logout when token expires (401 error)
- **Refresh:** Optional refresh token to get new token without re-login

### **4.3 Session Persistence**
```
User logs in
    ↓
Token + user data stored in browser localStorage
    ↓
User closes browser and leaves
    ↓
User returns later → Frontend checks localStorage
    ↓
If valid token exists → Auto-login (no re-enter credentials)
    ↓
If token expired → Redirect to login
```

---

## 5. LOAN APPLICATION WORKFLOW

### **5.1 Application Lifecycle**

```
┌─────────────────────────────────────────────────────────────┐
│                    APPLICANT ACTIONS                         │
├─────────────────────────────────────────────────────────────┤
│
│  Step 1: CREATE APPLICATION (Status: DRAFT)
│  ├─ Applicant fills form: Loan Amount, Term, Purpose
│  ├─ Income information
│  ├─ Can SAVE AS DRAFT or SUBMIT
│  └─ Only applicant can edit draft
│
│  Step 2: UPLOAD DOCUMENTS (Status: DRAFT)
│  ├─ Applicant uploads required docs:
│  │  - ID Proof
│  │  - Income Certificate
│  │  - Bank Statements
│  │  - Employment Letter
│  ├─ Can upload multiple times
│  └─ Stores in cloud/server storage
│
│  Step 3: SUBMIT APPLICATION (Status: SUBMITTED)
│  ├─ Applicant submits application
│  ├─ Application sent to Processor queue
│  ├─ Applicant CANNOT edit after submission
│  └─ Applicant can only VIEW & TRACK

└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    PROCESSOR ACTIONS                         │
├─────────────────────────────────────────────────────────────┤
│
│  Step 4: REVIEW DOCUMENTS (Status: IN-REVIEW)
│  ├─ Processor receives submitted application
│  ├─ Reviews each uploaded document
│  ├─ For each document:
│  │  ├─ APPROVE (valid & authentic)
│  │  ├─ REJECT (missing, invalid, expired)
│  │  └─ Add verification notes
│  ├─ Documents individually marked VERIFIED/REJECTED
│  └─ Processor can request re-upload if needed
│
│  Step 5: VERIFICATION COMPLETE (Status: VERIFIED)
│  ├─ All documents approved → Status = VERIFIED
│  ├─ Application auto-moves to Underwriter queue
│  └─ Processor's work done

└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  UNDERWRITER ACTIONS                         │
├─────────────────────────────────────────────────────────────┤
│
│  Step 6: LOAN DECISION (Status: PENDING-DECISION)
│  ├─ Underwriter receives verified application
│  ├─ Reviews application details
│  ├─ System provides recommendations:
│  │  ├─ Credit Score Analysis
│  │  ├─ Income Verification Status
│  │  ├─ Debt-to-Income Ratio
│  │  └─ Loan Eligibility Score
│  ├─ Underwriter decides:
│  │  ├─ APPROVE → Status = APPROVED
│  │  ├─ REJECT → Status = REJECTED
│  │  └─ REFER → Status = REFERRED (needs review)
│  └─ Adds decision reasoning/comments
│
│  Step 7: FINAL STATUS
│  ├─ Status = APPROVED/REJECTED/REFERRED
│  └─ Applicant notified

└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   APPLICANT VIEWS FINAL                      │
├─────────────────────────────────────────────────────────────┤
│
│  Step 8: TRACK FINAL DECISION
│  ├─ Applicant sees final status
│  ├─ Can view entire history
│  ├─ If approved → Loan disbursal process begins
│  ├─ If rejected → Can appeal or reapply
│  └─ Can download approved documents

└─────────────────────────────────────────────────────────────┘
```

### **5.2 Application Status States**

| Status | Visible To | Meaning |
|--------|-----------|---------|
| **DRAFT** | Applicant Only | Application created but not submitted |
| **SUBMITTED** | All | Application awaiting processor review |
| **IN-REVIEW** | Processor, Underwriter, Admin | Processor verifying documents |
| **VERIFIED** | Underwriter, Applicant, Admin | Documents verified, awaiting decision |
| **PENDING-DECISION** | Underwriter, Admin | Awaiting final underwriter decision |
| **APPROVED** | All | Loan approved, ready for disbursal |
| **REJECTED** | Applicant, Admin | Loan rejected (applicant can reapply) |
| **REFERRED** | Admin, Underwriter | Needs special review/approval |

---

## 6. DATA FLOW & API INTEGRATION

### **6.1 Frontend → Backend Communication**

```
Frontend Component needs data
    ↓
Calls Service (e.g., loanService.getMyApplications())
    ↓
Service creates HTTP request with parameters
    ↓
Axios Interceptor:
    ├─ Attaches JWT token to headers
    ├─ Sets Content-Type: application/json
    └─ Adds timeout (10 seconds)
    ↓
Request sent to Backend (POST/GET/PUT/DELETE)
    ↓
Backend validates:
    ├─ JWT token signature
    ├─ User role permissions
    ├─ Request parameters
    └─ Business logic
    ↓
If valid → Execute query → Return data
    ↓
If invalid → Return error (400/401/403/404/500)
    ↓
Axios Response Interceptor:
    ├─ If 401 → Logout user, redirect to /login
    ├─ If 403 → Show "Unauthorized"
    ├─ If 500 → Show "Server Error"
    └─ Otherwise → Pass response to component
    ↓
Component updates UI with data
```

### **6.2 Service Layer (Frontend)**

All API calls go through service files:

**authService.js:**
- `login(email, password)` → POST /api/auth/login
- `signup(userData)` → POST /api/auth/signup
- `logout()` → POST /api/auth/logout
- `getCurrentUser()` → GET /api/auth/me

**loanService.js:**
- `createApplication(data)` → POST /api/loans/applications
- `getMyApplications(page, limit)` → GET /api/loans/applications?page=1
- `getApplicationById(id)` → GET /api/loans/applications/:id
- `submitApplication(id)` → PUT /api/loans/applications/:id/submit
- `getApplicationsForProcessor()` → GET /api/loans/processor/applications
- `getApplicationsForUnderwriter()` → GET /api/loans/underwriter/applications
- `makeDecision(id, decision)` → POST /api/loans/underwriter/decision

**documentService.js:**
- `uploadDocument(appId, file)` → POST /api/documents/upload (multipart/form-data)
- `getUploadedDocuments(appId)` → GET /api/documents/applications/:appId
- `verifyDocument(docId, status)` → PUT /api/documents/:docId/verify
- `deleteDocument(docId)` → DELETE /api/documents/:docId

**userService.js:**
- `getAllUsers(page, limit)` → GET /api/users?page=1
- `createUser(userData)` → POST /api/users
- `updateUser(id, data)` → PUT /api/users/:id
- `deleteUser(id)` → DELETE /api/users/:id
- `getAuditLogs(page)` → GET /api/audit-logs

---

## 7. CORE FEATURES

### **7.1 Multi-Step Loan Application Form**

```
Step 1: Loan Details
├─ Loan Amount (input: 10000 - 1000000)
├─ Loan Term (input: 1 - 60 months)
├─ [Previous] [Next] buttons

Step 2: Personal Information
├─ Purpose of Loan (dropdown)
├─ Annual Income (input)
├─ Employment Status (dropdown)
├─ [Previous] [Next] buttons

Step 3: Review & Submit
├─ Shows all entered data
├─ Agreement checkbox
├─ [Previous] [Save as Draft] [Submit] buttons
```

### **7.2 Document Upload & Verification**

```
Upload Flow:
├─ Applicant selects file from computer
├─ Frontend validates: type, size, format
├─ Sends via multipart/form-data
├─ Backend stores: database + file storage
├─ Returns file ID & preview URL

Verification Flow:
├─ Processor sees document in dashboard
├─ Can download/preview document
├─ Decides: APPROVED or REJECTED
├─ Adds notes (e.g., "Expired ID, request renewal")
├─ If rejected → Applicant notified to re-upload
├─ If approved → Counted towards verification
```

### **7.3 Dashboard Analytics**

**Applicant Dashboard:**
- Total applications count
- Applications by status (Draft, Submitted, Approved, Rejected)
- Quick actions (Apply, View, Track)

**Processor Dashboard:**
- Pending verification count
- In-progress count
- Completed verification count

**Underwriter Dashboard:**
- Pending decision count
- Approved count
- Rejected count

**Admin Dashboard:**
- Total users
- Total applications
- Approved loans count
- Rejected loans count

---

## 8. ROLE-BASED ACCESS CONTROL (RBAC)

### **8.1 Route Protection**

```
User visits URL
    ↓
Frontend checks authentication state
    ├─ Is user logged in? (token exists)
    └─ Is user's role authorized for this route?
    ↓
ProtectedRoute Component:
├─ If not logged in → Redirect to /login
├─ If wrong role → Show "Unauthorized" page
└─ If correct role → Render component
    ↓
Component loads and makes API calls
    ↓
Backend validates again:
├─ JWT token valid?
├─ User role authorized for this endpoint?
├─ User permitted to view this data?
```

### **8.2 Data Isolation**

```
Applicant can only see:
├─ Own applications
├─ Own documents
├─ Own profile

Processor can only see:
├─ Applications with status ≥ SUBMITTED
├─ Not own applications (no conflict of interest)

Underwriter can only see:
├─ Verified applications (status ≥ VERIFIED)
└─ Can make decisions only on PENDING-DECISION status

Admin can see:
└─ Everything (with audit trail)
```

---

## 9. DATA STORAGE & PERSISTENCE

### **9.1 Frontend Storage**

**LocalStorage (Browser):**
- JWT token (expires server-side)
- User object (name, email, role)
- Application state if needed

**SessionStorage (Browser):**
- Form data while filling application
- Filter selections on pages

**In-Memory State (React):**
- Component-level loading/error states
- UI toggles (modals, dropdowns)

### **9.2 Backend Storage**

**Database Tables:**
```
users
├─ id, name, email, password_hash, role, created_at

applications
├─ id, applicant_id, loan_amount, term, purpose, status, created_at

application_details
├─ application_id, income, employment_status, co_applicant_info

documents
├─ id, application_id, file_path, file_type, upload_date, verification_status

verification_logs
├─ id, document_id, processor_id, status, notes, timestamp

loan_decisions
├─ id, application_id, underwriter_id, decision, comments, timestamp

audit_logs
├─ id, user_id, action, target_entity, timestamp, status
```

---

## 10. ERROR HANDLING & VALIDATION

### **10.1 Frontend Validation**

```
User submits form
    ↓
Frontend validates:
├─ Required fields filled?
├─ Email format valid?
├─ Password strong enough?
├─ Numbers in valid range?
├─ File size < 5MB?
    ↓
If error → Show message to user (no API call)
If valid → Send to backend
```

### **10.2 Backend Validation**

```
Backend receives request
    ↓
Validates again:
├─ JWT token valid?
├─ User authenticated?
├─ User role permitted?
├─ Data format correct?
├─ Business logic valid?
    ↓
If validation fails → Return 400/401/403/422 error
If valid → Process request → Return 200 with data
    ↓
Frontend catches errors in axios interceptor
    ↓
Shows appropriate error message to user
```

---

## 11. AUDIT & COMPLIANCE

### **11.1 Audit Logging**

Every important action logged:
```
User Actions Logged:
├─ Login/Logout
├─ Application created/submitted/updated
├─ Document uploaded/verified/rejected
├─ Decision made (approve/reject/refer)
├─ User created/updated/deleted
├─ Role changed
└─ Permission errors

Audit Log Entry Contains:
├─ Timestamp
├─ User ID who performed action
├─ Action type
├─ Entity affected (application ID, document ID, etc.)
├─ Status (success/failure)
└─ Changes made (before/after values)

Admin can:
├─ View full audit trail
├─ Filter by user, date, action
├─ Export logs for compliance
└─ Track who changed what and when
```

---

## 12. SECURITY LAYERS

```
Layer 1: Frontend
├─ Input validation
├─ HTTPS only communication
├─ LocalStorage encryption (optional)
└─ CSRF token for forms

Layer 2: API Gateway
├─ CORS policy enforcement
├─ Rate limiting
├─ Request logging
└─ DDoS protection

Layer 3: Authentication
├─ JWT token validation
├─ Token expiration
├─ Password hashing (bcrypt)
└─ MFA (optional)

Layer 4: Authorization
├─ Role-based access control (RBAC)
├─ Resource-level permissions
├─ Data isolation
└─ Audit logging

Layer 5: Database
├─ SQL injection prevention (prepared statements)
├─ Encryption at rest
├─ Backup & disaster recovery
└─ Access control
```

---

## 13. TECHNOLOGY STACK

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19.2.8 | UI Components |
| **Build Tool** | Vite | Fast bundling |
| **Styling** | Tailwind CSS | Utility-first CSS |
| **HTTP Client** | Axios 1.19 | API communication |
| **Routing** | React Router 7.18 | Client-side navigation |
| **State Management** | Context API | Global auth state |
| **Backend** | Node.js / Spring / Django | Server logic |
| **Database** | MySQL / PostgreSQL | Data persistence |
| **Authentication** | JWT (JSON Web Tokens) | Stateless auth |
| **File Storage** | AWS S3 / Local / GCS | Document storage |

---

## 14. DEPLOYMENT ARCHITECTURE

```
┌─────────────────────────────────────────┐
│        User's Browser / Device          │
├─────────────────────────────────────────┤
│   React App (http://localhost:3000)     │
│   - Vite dev server OR                  │
│   - Production build deployed to CDN    │
└────────────┬────────────────────────────┘
             │
             │ HTTP/HTTPS
             │
┌────────────┴────────────────────────────┐
│      API Server (http://localhost:8080) │
├─────────────────────────────────────────┤
│   - Node.js + Express OR                │
│   - Spring Boot OR                      │
│   - Django / FastAPI                    │
└────────────┬────────────────────────────┘
             │
             │ Database Driver
             │
┌────────────┴────────────────────────────┐
│     Database (MySQL/PostgreSQL)         │
├─────────────────────────────────────────┤
│   - Loan data                           │
│   - User credentials                    │
│   - Documents metadata                  │
│   - Audit logs                          │
└─────────────────────────────────────────┘
```

---

## 15. KEY WORKFLOWS SUMMARY

### **Workflow 1: Complete Happy Path**

```
Applicant
  └─ Login
     └─ Create & Submit Loan Application
        └─ Upload Documents
           └─ Processor Verifies Documents
              └─ Underwriter Reviews & Approves
                 └─ Applicant Notified
                    └─ Loan Disbursal
```

### **Workflow 2: Problem Resolution**

```
Applicant uploads incomplete documents
  └─ Processor rejects with notes
     └─ Applicant notified
        └─ Applicant re-uploads corrected docs
           └─ Processor verifies again
              └─ If OK → moves to underwriter
              └─ If not OK → repeat
```

### **Workflow 3: Rejection & Reapplication**

```
Underwriter rejects application
  └─ Applicant notified with reason
     └─ Applicant can reapply
        └─ New application created (new cycle)
```

---

## 16. ADMIN CAPABILITIES

```
Admin Functions:
├─ User Management
│  ├─ Create new users (Processor, Underwriter, Admin)
│  ├─ Update user details
│  ├─ Reset passwords
│  ├─ Deactivate/Delete users
│  └─ Assign roles
│
├─ System Configuration
│  ├─ Set loan eligibility criteria
│  ├─ Configure approval rules
│  ├─ Set document requirements
│  └─ Configure thresholds
│
├─ Reporting & Analytics
│  ├─ Total applications count
│  ├─ Approval rate
│  ├─ Average processing time
│  ├─ User activity report
│  └─ Revenue analysis
│
└─ Audit & Compliance
   ├─ View complete audit logs
   ├─ Filter by date, user, action
   ├─ Export compliance reports
   └─ Track all system changes
```

---

## 17. PERFORMANCE & SCALABILITY

### **Frontend Optimization:**
- ✅ Component lazy loading
- ✅ Memoization of expensive computations
- ✅ Image optimization
- ✅ Code splitting with React Router

### **Backend Optimization:**
- ✅ Database indexing on frequently queried fields
- ✅ Caching layer (Redis) for frequently accessed data
- ✅ Pagination for large datasets
- ✅ Connection pooling for database

### **Scalability:**
- ✅ Horizontal scaling of API servers
- ✅ Load balancing
- ✅ CDN for static assets
- ✅ Database replication

---

## 18. TESTING STRATEGY

### **Frontend Testing:**
- Unit tests: Individual components
- Integration tests: Component interactions
- E2E tests: Full user workflows (login → apply → verify)

### **Backend Testing:**
- Unit tests: Service methods
- Integration tests: API endpoints
- Load tests: Performance under stress

---

## 19. DEPLOYMENT CHECKLIST

Before going live:
- ✅ All services working with backend
- ✅ Error handling complete
- ✅ Security audit done
- ✅ Database backed up
- ✅ Monitoring set up
- ✅ Documentation complete
- ✅ User training done
- ✅ Compliance verified

---

## 20. FUTURE ENHANCEMENTS

Possible additions:
- SMS/Email notifications for status updates
- Mobile app (React Native)
- Advanced analytics dashboard
- Loan refinancing workflow
- Co-applicant support
- Electronic signature integration
- API for third-party integrations
- Multi-language support
- Two-factor authentication
- Blockchain for document verification

---

## CONCLUSION

**LoanLite** is a complete, production-ready loan management system with:
- ✅ Secure authentication (JWT)
- ✅ Role-based access control
- ✅ Complete application lifecycle management
- ✅ Document verification workflow
- ✅ Decision-making system
- ✅ Audit logging
- ✅ Admin controls
- ✅ User-friendly interface

The system is designed to be scalable, secure, and maintainable, with clear separation of concerns between frontend and backend.
