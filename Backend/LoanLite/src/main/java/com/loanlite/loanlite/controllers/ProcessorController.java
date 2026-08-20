package com.loanlite.loanlite.controllers;

import com.loanlite.loanlite.entities.Document;
import com.loanlite.loanlite.entities.LoanApplication;
import com.loanlite.loanlite.entities.User;
import com.loanlite.loanlite.services.DocumentService;
import com.loanlite.loanlite.services.LoanApplicationService;
import com.loanlite.loanlite.services.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api")
public class ProcessorController {

    @Autowired
    private LoanApplicationService loanApplicationService;

    @Autowired
    private DocumentService documentService;

    @Autowired
    private UserService userService;

    // Required applicant documents before a processor can complete verification.
    private static final List<String> REQUIRED_DOCUMENT_TYPES = List.of(
            "PAN_CARD",
            "SALARY_SLIP",
            "ADDRESS_PROOF"
    );

    // GET /api/processor/work-list
    // Returns applications that are waiting for a staff member, typically those in Submitted state.
    @GetMapping("/processor/work-list")
    public ResponseEntity<List<LoanApplication>> getWorkList() {
        return ResponseEntity.ok(loanApplicationService.findByStatus("Submitted"));
    }

    // POST /api/applications/{applicationId}/claim
    // Assigns the currently logged-in processor to the application and changes its state to In Review.
    @PostMapping("/applications/{applicationId}/claim")
    public ResponseEntity<LoanApplication> claimApplication(@PathVariable Long applicationId) {
        LoanApplication existing = loanApplicationService.getApplication(applicationId);
        if (existing.getStatus() == null || !existing.getStatus().equalsIgnoreCase("Submitted")) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(existing);
        }

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        User processor = userService.findByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("Processor not found for email: " + authentication.getName()));

        existing.setProcessor(processor);
        existing.setStatus("In Review");
        existing.setUpdatedAt(LocalDateTime.now());
        return ResponseEntity.ok(loanApplicationService.updateApplication(applicationId, existing));
    }

    // GET /api/applications/{applicationId}
    // Fetches the full application details for the processor to prepare the file review.
    @GetMapping("/applications/{applicationId}")
    public ResponseEntity<LoanApplication> getApplication(@PathVariable Long applicationId) {
        return ResponseEntity.ok(loanApplicationService.getApplication(applicationId));
    }

    // GET /api/applications/{applicationId}/documents
    // Returns uploaded documents and highlights any required documents that are still missing.
    @GetMapping("/applications/{applicationId}/documents")
    public ResponseEntity<Map<String, Object>> getApplicationDocuments(@PathVariable Long applicationId) {
        List<Document> documents = documentService.findByApplicationId(applicationId);

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

    // PATCH /api/applications/{applicationId}/documents/{documentId}
    // Updates the verification status of one uploaded document, for example Verified or Rejected.
    @PatchMapping("/applications/{applicationId}/documents/{documentId}")
    public ResponseEntity<Document> updateDocumentStatus(
            @PathVariable Long applicationId,
            @PathVariable Long documentId,
            @RequestBody Map<String, String> payload) {

        Document existing = documentService.getDocument(documentId);
        if (!existing.getApplication().getId().equals(applicationId)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
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

        return ResponseEntity.ok(documentService.updateDocument(documentId, existing));
    }

    // PATCH /api/applications/{applicationId}/request-documents
    // Requests missing documents from the applicant and marks the application as Waiting for Documents.
    @PatchMapping("/applications/{applicationId}/request-documents")
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
    }

    // POST /api/applications/{applicationId}/verify
    // Confirms the file is complete, checks rules, and creates a processor recommendation before handoff to underwriter.
    @PostMapping("/applications/{applicationId}/verify")
    public ResponseEntity<LoanApplication> verifyApplication(@PathVariable Long applicationId) {
        LoanApplication existing = loanApplicationService.getApplication(applicationId);
        List<Document> documents = documentService.findByApplicationId(applicationId);

        boolean hasMissingRequiredDocuments = REQUIRED_DOCUMENT_TYPES.stream()
                .anyMatch(required -> documents.stream()
                        .noneMatch(doc -> required.equalsIgnoreCase(doc.getDocumentType())));

        boolean hasRejectedDocument = documents.stream()
                .anyMatch(doc -> "REJECTED".equalsIgnoreCase(doc.getVerificationStatus()));

        String recommendation;
        String reason;
        if (hasMissingRequiredDocuments) {
            recommendation = "REJECTED";
            reason = "Missing required documents.";
            existing.setStatus("Waiting for Documents");
        } else if (hasRejectedDocument) {
            recommendation = "REJECTED";
            reason = "One or more uploaded documents were rejected.";
            existing.setStatus("Waiting for Documents");
        } else {
            Integer creditScore = existing.getCreditScore() == null ? 0 : existing.getCreditScore();
            if (creditScore >= 700 && (existing.getVerifiedIncome() == null || existing.getVerifiedIncome().compareTo(new java.math.BigDecimal("30000")) >= 0)) {
                recommendation = "APPROVE";
                reason = "All required documents are verified and credit profile meets minimum criteria.";
                existing.setStatus("Ready for Underwriter");
            } else if (creditScore >= 650) {
                recommendation = "MANUAL_REVIEW";
                reason = "Application meets basic conditions but requires manual review.";
                existing.setStatus("Ready for Underwriter");
            } else {
                recommendation = "REJECT";
                reason = "Application does not meet minimum eligibility rules.";
                existing.setStatus("Ready for Underwriter");
            }
        }

        existing.setRecommendation(recommendation);
        existing.setRecommendationReason(reason);
        existing.setUpdatedAt(LocalDateTime.now());

        return ResponseEntity.ok(loanApplicationService.updateApplication(applicationId, existing));
    }
}
