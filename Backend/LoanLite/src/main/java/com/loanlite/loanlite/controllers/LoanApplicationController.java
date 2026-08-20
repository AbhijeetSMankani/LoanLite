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
import java.util.Set;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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
import com.loanlite.loanlite.services.DocumentService;
import com.loanlite.loanlite.services.LoanApplicationService;

@RestController
@RequestMapping({"/api/loan-applications", "/api/applications"})
public class LoanApplicationController {
    @Autowired
    private LoanApplicationService service;

    @Autowired
    private DocumentService documentService;

    // Required applicant documents before a processor can complete verification.
    private static final List<String> REQUIRED_DOCUMENT_TYPES = List.of(
            "PAN_CARD",
            "SALARY_SLIP",
            "ADDRESS_PROOF"
    );

    // POST /api/applications
    // Creates a new loan application and sets the initial state to Draft
    // so the applicant can continue filling the form later.
    @PostMapping
    public ResponseEntity<LoanApplication> create(@RequestBody LoanApplication app) {
        if (app.getStatus() == null || app.getStatus().isBlank()) {
            app.setStatus("Draft");
        }
        if (app.getApplicationNumber() == null || app.getApplicationNumber().isBlank()) {
            app.setApplicationNumber("APP-" + System.currentTimeMillis());
        }
        LoanApplication created = service.createApplication(app);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    // GET /api/applications
    // Returns applications, optionally filtered by any combination of status,
    // processorId, underwriterId, and applicantId.
    @GetMapping
    public ResponseEntity<List<LoanApplication>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long processorId,
            @RequestParam(required = false) Long underwriterId,
            @RequestParam(required = false) Long applicantId) {
        return ResponseEntity.ok(service.search(status, processorId, underwriterId, applicantId));
    }

    // GET /api/applications/{applicationId}
    // Fetches the full application details for the processor to prepare the file review.
    @GetMapping("/{id}")
    public ResponseEntity<LoanApplication> getApplication(@PathVariable Long id) {
        return ResponseEntity.ok(service.getApplication(id));
    }

    // GET /api/applications/application-number/{applicationNumber}
    // Finds an application using its unique application number.
    @GetMapping("/application-number/{applicationNumber}")
    public ResponseEntity<LoanApplication> getByApplicationNumber(@PathVariable String applicationNumber) {
        return service.findByApplicationNumber(applicationNumber)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // PUT /api/applications/{applicationId}
    // Saves the latest application form progress while the applicant continues editing it.
    @PutMapping("/{id}")
    public ResponseEntity<LoanApplication> update(@PathVariable Long id, @RequestBody LoanApplication app) {
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
