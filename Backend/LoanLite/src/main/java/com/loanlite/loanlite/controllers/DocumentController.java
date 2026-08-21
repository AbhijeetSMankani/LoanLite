package com.loanlite.loanlite.controllers;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
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
import com.loanlite.loanlite.security.LoanApplicationAccessGuard;
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
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(doc);
    }

    // GET /api/documents
    // Returns every document record the caller has access to: an applicant's own
    // application(s), a processor/underwriter's assigned/claimed application(s), or
    // everything for admin.
    @GetMapping
    public ResponseEntity<List<Document>> list() {
        User caller = accessGuard.currentUser();
        List<Document> visible = service.listDocuments().stream()
                .filter(doc -> accessGuard.hasAccess(doc.getApplication(), caller))
                .collect(Collectors.toList());
        return ResponseEntity.ok(visible);
    }

    // PUT /api/documents/{id}
    // Replaces a document's fields, for example its verification status or remarks. PROCESSOR,
    // UNDERWRITER, and ADMIN only - not ownership-based, no applicant access at all. Applies
    // verificationStatus/remarks/filePath/application verbatim with zero field stripping, so an
    // applicant reaching this could self-certify their own document; they upload via
    // POST /applications/{id}/documents instead, never through this endpoint.
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('PROCESSOR','UNDERWRITER','ADMIN')")
    public ResponseEntity<Document> update(@PathVariable Long id, @RequestBody Document doc) {
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
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
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

        Document existing = service.getDocument(documentId); //? Check the document's applicationId against the currently logged-in user's id, to see if they are allowed to update it. If not, return 403 Forbidden.
        // if (!existing.getApplication().getId().equals(applicationId)) {
        //     return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        // }

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

        return ResponseEntity.ok(service.updateDocument(documentId, existing));
    }


    // PATCH /api/applications/{applicationId}/request-documents
    // Requests missing documents from the applicant and marks the application as Waiting for Documents.
    @PatchMapping("/applications/{applicationId}/request-documents")
    @PreAuthorize("hasRole('PROCESSOR')")
    public ResponseEntity<LoanApplication> requestDocuments(
            @PathVariable Long applicationId,
            @RequestBody(required = false) Map<String, String> payload) {

        LoanApplication existing = loanApplicationService.getApplication(applicationId);
        existing.setStatus("Waiting for Documents");
        existing.setUpdatedAt(LocalDateTime.now());
        if (payload != null && payload.get("message") != null) {
            existing.setDecisionComments(payload.get("message"));
        }

        return ResponseEntity.ok(loanApplicationService.updateApplication(applicationId, existing));
    } //TODO: move to processor controller, since the processor is requesting the documents.




}
