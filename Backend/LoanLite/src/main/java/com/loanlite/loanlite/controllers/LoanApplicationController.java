package com.loanlite.loanlite.controllers;

import com.loanlite.loanlite.entities.Document;
import com.loanlite.loanlite.entities.LoanApplication;
import com.loanlite.loanlite.services.DocumentService;
import com.loanlite.loanlite.services.LoanApplicationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@RestController
@RequestMapping({"/api", "/api/loan-applications", "/api/applications"})
public class LoanApplicationController {
    @Autowired
    private LoanApplicationService service;

    @Autowired
    private DocumentService documentService;

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
    // Retrieves the applicant's own applications. If applicantId is supplied,
    // it filters the list to only that applicant; otherwise returns all records.
    @GetMapping
    public ResponseEntity<List<LoanApplication>> list(@RequestParam(value = "applicantId", required = false) Long applicantId) {
        if (applicantId != null) {
            return ResponseEntity.ok(service.findByApplicantId(applicantId));
        }
        return ResponseEntity.ok(service.listApplications());
    }

    // GET /api/applications/application-number/{applicationNumber}
    // Finds an application using its unique application number.
    @GetMapping("/application-number/{applicationNumber}")
    public ResponseEntity<LoanApplication> getByApplicationNumber(@PathVariable String applicationNumber) {
        return service.findByApplicationNumber(applicationNumber)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // GET /api/applications/applicant/{applicantId}
    // Loads all applications belonging to one applicant.
    @GetMapping("/applicant/{applicantId}")
    public ResponseEntity<List<LoanApplication>> getByApplicantId(@PathVariable Long applicantId) {
        return ResponseEntity.ok(service.findByApplicantId(applicantId));
    }

    // GET /api/applications/status/{status}
    // Returns all applications filtered by status such as Draft, Submitted, Approved, or Withdrawn.
    @GetMapping("/status/{status}")
    public ResponseEntity<List<LoanApplication>> getByStatus(@PathVariable String status) {
        return ResponseEntity.ok(service.findByStatus(status));
    }

    // GET /api/applications/processor/{processorId}
    // Lists all applications assigned to a processor for review.
    @GetMapping("/processor/{processorId}")
    public ResponseEntity<List<LoanApplication>> getByProcessorId(@PathVariable Long processorId) {
        return ResponseEntity.ok(service.findByProcessorId(processorId));
    }

    // GET /api/applications/underwriter/{underwriterId}
    // Lists all applications assigned to an underwriter for final evaluation.
    @GetMapping("/underwriter/{underwriterId}")
    public ResponseEntity<List<LoanApplication>> getByUnderwriterId(@PathVariable Long underwriterId) {
        return ResponseEntity.ok(service.findByUnderwriterId(underwriterId));
    }

    // PUT /api/applications/{applicationId}
    // Saves the latest application form progress while the applicant continues editing it.
    @PutMapping("/{id}")
    public ResponseEntity<LoanApplication> update(@PathVariable Long id, @RequestBody LoanApplication app) {
        return ResponseEntity.ok(service.updateApplication(id, app));
    }

    // POST /api/applications/{applicationId}/submit
    // Submits the finished application and moves it from Draft to Submitted.
    @PostMapping("/{id}/submit")
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
    @PatchMapping("/{id}/withdraw")
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

    // DELETE /api/applications/{applicationId}
    // Removes an application record from the system.
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.deleteApplication(id);
        return ResponseEntity.noContent().build();
    }
} 
