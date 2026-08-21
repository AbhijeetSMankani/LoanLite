package com.loanlite.loanlite.controllers;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.loanlite.loanlite.entities.Document;
import com.loanlite.loanlite.entities.LoanApplication;
import com.loanlite.loanlite.entities.User;
import com.loanlite.loanlite.security.LoanApplicationAccessGuard;
import com.loanlite.loanlite.services.DocumentService;
import com.loanlite.loanlite.services.LoanApplicationService;

@RestController
@RequestMapping({"/api/loan-applications", "/api/applications"})
public class LoanApplicationController {
    @Autowired
    private LoanApplicationService service;

    @Autowired
    private DocumentService documentService;

    @Autowired
    private LoanApplicationAccessGuard accessGuard;

    // Required applicant documents before a processor can complete verification.
    private static final List<String> REQUIRED_DOCUMENT_TYPES = List.of(
            "PAN_CARD",
            "SALARY_SLIP",
            "ADDRESS_PROOF"
    );

    // POST /api/applications
    // Creates a new loan application for the authenticated applicant and sets the initial
    // state to Draft so they can continue filling the form later. USER only: the applicant is
    // always the caller (any applicant id in the body is ignored), and status/recommendation/
    // recommendationReason/decision/decisionComments/processor/underwriter/creditScore/
    // verifiedIncome are all forced back to their initial values regardless of what the caller
    // sends - those only get set later by staff-only actions (processor verify, underwriter
    // decision), never by the applicant at creation time.
    @PostMapping
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<LoanApplication> create(@RequestBody LoanApplication app) {
        app.setApplicant(accessGuard.currentUser());
        app.setStatus("Draft");
        app.setRecommendation(null);
        app.setRecommendationReason(null);
        app.setDecision(null);
        app.setDecisionComments(null);
        app.setProcessor(null);
        app.setUnderwriter(null);
        app.setCreditScore(null);
        app.setVerifiedIncome(null);

        if (app.getApplicationNumber() == null || app.getApplicationNumber().isBlank()) {
            app.setApplicationNumber("APP-" + System.currentTimeMillis());
        }
        LoanApplication created = service.createApplication(app);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    // GET /api/applications
    // Returns applications, optionally filtered by any combination of status,
    // processorId, underwriterId, and applicantId. Non-admin callers are always scoped to their
    // own applications regardless of what's requested: applicants are forced to their own
    // applicantId, processors/underwriters to their own processorId/underwriterId. Whatever else
    // the caller passes only narrows further from there, it never widens what's visible.
    @GetMapping
    public ResponseEntity<List<LoanApplication>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long processorId,
            @RequestParam(required = false) Long underwriterId,
            @RequestParam(required = false) Long applicantId) {
        User caller = accessGuard.currentUser();
        if (!accessGuard.isAdmin(caller)) {
            if (accessGuard.isProcessorRole(caller)) {
                processorId = caller.getId();
            } else if (accessGuard.isUnderwriterRole(caller)) {
                underwriterId = caller.getId();
            } else {
                applicantId = caller.getId();
            }
        }
        return ResponseEntity.ok(service.search(status, processorId, underwriterId, applicantId));
    }

    // GET /api/applications/{applicationId}
    // Fetches the full application details for the processor to prepare the file review.
    // Ownership-checked: owning applicant, assigned processor/underwriter, or admin only.
    @GetMapping("/{id}")
    public ResponseEntity<LoanApplication> getApplication(@PathVariable Long id) {
        LoanApplication app = service.getApplication(id);
        if (!accessGuard.hasAccess(app, accessGuard.currentUser())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(app);
    }

    // GET /api/applications/application-number/{applicationNumber}
    // Finds an application using its unique application number.
    // Ownership-checked: owning applicant, assigned processor/underwriter, or admin only.
    @GetMapping("/application-number/{applicationNumber}")
    public ResponseEntity<LoanApplication> getByApplicationNumber(@PathVariable String applicationNumber) {
        Optional<LoanApplication> found = service.findByApplicationNumber(applicationNumber);
        if (found.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        LoanApplication app = found.get();
        if (!accessGuard.hasAccess(app, accessGuard.currentUser())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(app);
    }

    // PUT /api/applications/{applicationId}
    // Saves the latest application form progress while the applicant continues editing it, or
    // lets assigned staff update details. Ownership-checked via the access-check helper. The
    // owning applicant may only update while the application is still in Draft - once
    // submitted they withdraw and create a new application instead of editing this one - and
    // even in Draft they cannot change status directly through this endpoint, only through
    // submit/withdraw. Staff (assigned processor/underwriter, or admin) can update at any status.
    @PutMapping("/{id}")
    public ResponseEntity<LoanApplication> update(@PathVariable Long id, @RequestBody LoanApplication app) {
        LoanApplication existing = service.getApplication(id);
        User caller = accessGuard.currentUser();

        if (!accessGuard.hasAccess(existing, caller)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        if (accessGuard.isOwningApplicant(existing, caller)) {
            if (!"Draft".equalsIgnoreCase(existing.getStatus())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
            app.setStatus(null);
        }

        return ResponseEntity.ok(service.updateApplication(id, app));
    }

    // POST /api/applications/{applicationId}/submit
    // Submits the finished application and moves it from Draft to Submitted.
    @PatchMapping("/submit/{id}")
    public ResponseEntity<LoanApplication> submitApplication(@PathVariable Long id) {
        LoanApplication existing = service.getApplication(id);
        existing.setStatus("Submitted");
        if (existing.getSubmittedAt() == null) {
            existing.setSubmittedAt(LocalDateTime.now());
        }
        existing.setUpdatedAt(LocalDateTime.now());
        return ResponseEntity.ok(service.updateApplication(id, existing));
    }

    // PATCH /api/applications/{applicationId}/withdraw
    // Cancels the application and changes its lifecycle state to Withdrawn.
    @PatchMapping("/withdraw/{id}")
    public ResponseEntity<LoanApplication> withdrawApplication(@PathVariable Long id) {
        LoanApplication existing = service.getApplication(id);
        existing.setStatus("Withdrawn");
        existing.setUpdatedAt(LocalDateTime.now());
        return ResponseEntity.ok(service.updateApplication(id, existing));
    }

    // POST /api/applications/{applicationId}/documents
    // Uploads a multipart file such as PAN card, salary slip, or address proof
    // and stores it against the application record.
    @PostMapping("/{id}/documents")
    public ResponseEntity<Document> uploadDocument(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "documentType", required = false, defaultValue = "OTHER") String documentType,
            @RequestParam(value = "remarks", required = false) String remarks) throws IOException {

        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        LoanApplication application = service.getApplication(id);
        String originalFileName = file.getOriginalFilename() == null ? "document" : file.getOriginalFilename();
        Path uploadDir = Paths.get("uploads", "applications", String.valueOf(id));
        Files.createDirectories(uploadDir);

        String safeFileName = UUID.randomUUID() + "_" + originalFileName.replaceAll("[^a-zA-Z0-9._-]", "_");
        Path target = uploadDir.resolve(safeFileName);
        Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);

        Document document = new Document();
        document.setApplication(application);
        document.setDocumentType(documentType.toUpperCase(Locale.ROOT));
        document.setFileName(originalFileName);
        document.setFilePath(target.toString().replace("\\", "/"));
        document.setVerificationStatus("PENDING");
        document.setRemarks(remarks);
        document.setUploadedAt(LocalDateTime.now());

        return ResponseEntity.status(HttpStatus.CREATED).body(documentService.createDocument(document));
    }

        // GET /api/documents/applications/{applicationId}
    // Returns uploaded documents and highlights any required documents that are still missing.
    @GetMapping("/{id}/documents")
    public ResponseEntity<Map<String, Object>> getApplicationDocuments(@PathVariable Long id) {
        List<Document> documents = documentService.findByApplicationId(id);

        Set<String> uploadedTypes = documents.stream()
                .map(Document::getDocumentType)
                .filter(type -> type != null && !type.isBlank())
                .map(type -> type.trim().toUpperCase(Locale.ROOT))
                .collect(java.util.stream.Collectors.toSet());

        List<String> missingRequiredDocuments = new ArrayList<>();
        for (String required : REQUIRED_DOCUMENT_TYPES) {
            if (!uploadedTypes.contains(required)) {
                missingRequiredDocuments.add(required);
            }
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("documents", documents);
        payload.put("missingRequiredDocuments", missingRequiredDocuments);
        return ResponseEntity.ok(payload);
    }

    // DELETE /api/applications/{applicationId}
    // Removes an application record from the system.
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.deleteApplication(id);
        return ResponseEntity.noContent().build();
    }
}
