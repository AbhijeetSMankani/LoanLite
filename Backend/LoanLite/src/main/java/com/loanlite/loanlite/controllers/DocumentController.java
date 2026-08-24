package com.loanlite.loanlite.controllers;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.loanlite.loanlite.entities.Document;
import com.loanlite.loanlite.entities.LoanApplication;
import com.loanlite.loanlite.entities.User;
import com.loanlite.loanlite.exception.ApiException;
import com.loanlite.loanlite.security.LoanApplicationAccessGuard;
import com.loanlite.loanlite.services.ApplicationHistoryService;
import com.loanlite.loanlite.services.DocumentService;
import com.loanlite.loanlite.services.LoanApplicationService;

@RestController
@RequestMapping("/api/documents")
public class DocumentController {
    @Autowired
    private DocumentService service;

    @Autowired
    private LoanApplicationService loanApplicationService;

    @Autowired
    private LoanApplicationAccessGuard accessGuard;

    @Autowired
    private ApplicationHistoryService historyService;

        // Required applicant documents before a processor can complete verification.
    private static final List<String> REQUIRED_DOCUMENT_TYPES = List.of(
            "PAN_CARD",
            "SALARY_SLIP",
            "ADDRESS_PROOF"
    );


    // POST /api/documents
    // Creates a document record directly from a JSON body (metadata only, no file upload).
    // For uploading an actual file, use POST /api/applications/{id}/documents instead.
    // ADMIN only: this persists the body verbatim (including verificationStatus), so anyone
    // else could self-certify a document without going through the real upload+review flow.
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Document> create(@RequestBody Document doc) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createDocument(doc));
    }

    // GET /api/documents/{id}
    // Fetches a single document record by its id. Ownership-checked via the document's
    // application: owning applicant, assigned processor/underwriter, or admin only.
    @GetMapping("/{id}")
    public ResponseEntity<Document> get(@PathVariable Long id) {
        Document doc = service.getDocument(id);
        if (!accessGuard.hasAccess(doc.getApplication(), accessGuard.currentUser())) {
            throw ApiException.forbidden("You do not have access to this document.");
        }
        return ResponseEntity.ok(doc);
    }

    // GET /api/documents
    // Returns every document record the caller has access to: an applicant's own
    // application(s), a processor/underwriter's assigned/claimed application(s), or
    // everything for admin. Ownership filter now lives in the query itself
    // (featuresTodo.csv task 11), not a post-fetch Java stream over every row in the table.
    @GetMapping
    public ResponseEntity<Page<Document>> list(@PageableDefault(size = 20) Pageable pageable) {
        User caller = accessGuard.currentUser();
        Page<Document> visible = service.listVisibleTo(caller.getId(), accessGuard.isAdmin(caller), pageable);
        return ResponseEntity.ok(visible);
    }

    // PUT /api/documents/{id}
    // Replaces a document's fields, for example its verification status or remarks. PROCESSOR,
    // UNDERWRITER, and ADMIN only - no applicant access at all (they upload via
    // POST /applications/{id}/documents instead, never through this endpoint). Ownership-checked:
    // a processor/underwriter must be assigned to the document's application, same pattern as
    // updateDocumentStatus()/requestDocuments() below; admin has no such restriction. Applies
    // verificationStatus/remarks/filePath/application verbatim with zero field stripping.
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('PROCESSOR','UNDERWRITER','ADMIN')")
    public ResponseEntity<Document> update(@PathVariable Long id, @RequestBody Document doc) {
        Document existing = service.getDocument(id);
        User caller = accessGuard.currentUser();
        boolean allowed = accessGuard.isAdmin(caller)
                || accessGuard.isAssignedProcessor(existing.getApplication(), caller)
                || accessGuard.isAssignedUnderwriter(existing.getApplication(), caller);
        if (!allowed) {
            throw ApiException.forbidden("You must be the assigned processor, underwriter, or admin to update this document.");
        }
        return ResponseEntity.ok(service.updateDocument(id, doc));
    }

    // DELETE /api/documents/{id}
    // Removes a document record from the system. The owning applicant may delete their own
    // document only while it's still PENDING; once it's been passed forward or rejected (any
    // other verificationStatus), only ADMIN may delete it - stops an applicant from erasing a
    // REJECTED document and re-triggering verification as if it never existed.
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        Document doc = service.getDocument(id);
        User caller = accessGuard.currentUser();

        boolean allowed = accessGuard.isAdmin(caller)
                || (accessGuard.isOwningApplicant(doc.getApplication(), caller)
                    && "PENDING".equalsIgnoreCase(doc.getVerificationStatus()));
        if (!allowed) {
            throw ApiException.forbidden("You may only delete your own document while it is still PENDING.");
        }

        service.deleteDocument(id);
        return ResponseEntity.noContent().build();
    }




    // PATCH /api/documents/{documentId}
    // Updates the verification status of one uploaded document, for example Verified or Rejected.
    @PatchMapping("/{documentId}")
    @PreAuthorize("hasRole('PROCESSOR')")
    public ResponseEntity<Document> updateDocumentStatus(
            @PathVariable Long documentId,
            @RequestBody Map<String, String> payload) {

        Document existing = service.getDocument(documentId);
        User caller = accessGuard.currentUser();
        if (!accessGuard.isAssignedProcessor(existing.getApplication(), caller)) {
            throw ApiException.forbidden("Only the assigned processor may update this document's status.");
        }

        String verificationStatus = payload.get("verificationStatus");
        if (verificationStatus == null || verificationStatus.isBlank()) {
            verificationStatus = payload.get("status");
        }
        if (verificationStatus != null && !verificationStatus.isBlank()) {
            existing.setVerificationStatus(verificationStatus.toUpperCase(Locale.ROOT));
        }
        if (payload.get("remarks") != null) {
            existing.setRemarks(payload.get("remarks"));
        }

        Document updated = service.updateDocument(documentId, existing);
        String newStatus = updated.getVerificationStatus();
        if ("VERIFIED".equalsIgnoreCase(newStatus) || "REJECTED".equalsIgnoreCase(newStatus)) {
            String action = "VERIFIED".equalsIgnoreCase(newStatus) ? "DOCUMENT_VERIFIED" : "DOCUMENT_REJECTED";
            String details = "Document '" + updated.getFileName() + "' (" + updated.getDocumentType()
                    + ") marked " + newStatus.toUpperCase(Locale.ROOT) + ".";
            historyService.log(updated.getApplication(), caller, action, details);
        }
        return ResponseEntity.ok(updated);
    }


    // PATCH /api/applications/{applicationId}/request-documents
    // Requests missing/corrected documents from the applicant. Sets status to
    // "Waiting for Documents" (backendTodo.csv task 8) - purely a cosmetic status string so the
    // applicant-facing UI can show a distinct "waiting on you" message; no access/query/work-list
    // rule is conditioned on this status, it behaves exactly like "Under Verification" everywhere
    // else. Assigned-processor-only, same ownership gap fix as verify(). Reverts back to
    // "Under Verification" automatically once the applicant uploads documents that satisfy every
    // required type again - see LoanApplicationController.uploadDocument().
    @PatchMapping("/applications/{applicationId}/request-documents")
    @PreAuthorize("hasRole('PROCESSOR')")
    public ResponseEntity<LoanApplication> requestDocuments(
            @PathVariable Long applicationId,
            @RequestBody(required = false) Map<String, String> payload) {

        LoanApplication existing = loanApplicationService.getApplication(applicationId);
        User caller = accessGuard.currentUser();
        if (!accessGuard.isAssignedProcessor(existing, caller)) {
            throw ApiException.forbidden("Only the assigned processor may request documents on this application.");
        }

        String message = payload != null ? payload.get("message") : null;
        if (message != null) {
            existing.setDecisionComments(message);
        }
        existing.setStatus("Waiting for Documents");
        existing.setUpdatedAt(LocalDateTime.now());

        LoanApplication updated = loanApplicationService.updateApplication(applicationId, existing);
        historyService.log(updated, caller, "DOCUMENTS_REQUESTED",
                message != null ? message : "Processor requested additional/corrected documents.");
        return ResponseEntity.ok(updated);
    }




}
