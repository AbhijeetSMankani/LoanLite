package com.loanlite.loanlite.controllers;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.loanlite.loanlite.entities.Document;
import com.loanlite.loanlite.entities.LoanApplication;
import com.loanlite.loanlite.entities.User;
import com.loanlite.loanlite.services.DocumentService;
import com.loanlite.loanlite.services.LoanApplicationService;
import com.loanlite.loanlite.services.UserService;

@RestController
@RequestMapping("/api/processor")
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
    @GetMapping("/work-list")
    @PreAuthorize("hasRole('PROCESSOR')")
    public ResponseEntity<List<LoanApplication>> getWorkList() {
        return ResponseEntity.ok(loanApplicationService.findByStatus("Submitted"));
    }

    // POST /api/processor/claim/{applicationId}
    // Assigns the currently logged-in processor to the application and changes its state to In Review.
    @PostMapping("/claim/{applicationId}")
    @PreAuthorize("hasRole('PROCESSOR')")
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



    // POST /api/applications/{applicationId}/verify
    // Confirms the file is complete, checks rules, and creates a processor recommendation before handoff to underwriter.
    @PostMapping("/applications/{applicationId}/verify")
    @PreAuthorize("hasRole('PROCESSOR')")
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
