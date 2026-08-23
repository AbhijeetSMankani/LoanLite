package com.loanlite.loanlite.controllers;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
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
@RequestMapping("/api/processor")
public class ProcessorController {

    @Autowired
    private LoanApplicationService loanApplicationService;

    @Autowired
    private DocumentService documentService;

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

    // GET /api/processor/work-list
    // Returns applications that are waiting for a staff member, typically those in Submitted state.
    @GetMapping("/work-list")
    @PreAuthorize("hasRole('PROCESSOR')")
    public ResponseEntity<Page<LoanApplication>> getWorkList(@PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(loanApplicationService.findByStatus("Submitted", pageable));
    }

    // POST /api/processor/claim/{applicationId}
    // Assigns the currently logged-in processor to the application and changes its state to Under
    // Verification. Uses an atomic conditional UPDATE (featuresTodo.csv task 6) instead of
    // read-check-then-save: two processors racing to claim the same application can no longer
    // both pass the status check before either write commits, since the WHERE clause re-checks
    // status as part of the same database write. The loser gets 409, not a silent 200.
    @PostMapping("/claim/{applicationId}")
    @PreAuthorize("hasRole('PROCESSOR')")
    public ResponseEntity<LoanApplication> claimApplication(@PathVariable Long applicationId) {
        User processor = accessGuard.currentUser();
        Optional<LoanApplication> claimed = loanApplicationService.claimForProcessor(
                applicationId, "Submitted", "Under Verification", processor.getId());
        if (claimed.isEmpty()) {
            LoanApplication current = loanApplicationService.getApplication(applicationId);
            return ResponseEntity.status(HttpStatus.CONFLICT).body(current);
        }

        LoanApplication updated = claimed.get();
        historyService.log(updated, processor, "PROCESSOR_CLAIMED", "Processor claimed the application for review.");
        return ResponseEntity.ok(updated);
    }



    // POST /api/applications/{applicationId}/verify
    // Confirms every required document has been individually verified, checks rules, and
    // creates a processor recommendation before handoff to underwriter. Assigned-processor-only
    // (not just any PROCESSOR) - this was a gap in the earlier auth lockdown effort, which
    // targeted CRUD endpoints, not this action endpoint. No more "Waiting for Documents" status:
    // if verification can't proceed, this returns 400 with a reason instead of changing status -
    // the application simply stays Under Verification.
    @PostMapping("/applications/{applicationId}/verify")
    @PreAuthorize("hasRole('PROCESSOR')")
    public ResponseEntity<LoanApplication> verifyApplication(@PathVariable Long applicationId) {
        LoanApplication existing = loanApplicationService.getApplication(applicationId);
        User caller = accessGuard.currentUser();
        if (!accessGuard.isAssignedProcessor(existing, caller)) {
            throw ApiException.forbidden("Only the assigned processor may verify this application.");
        }

        List<Document> documents = documentService.findByApplicationId(applicationId);

        // Every required type needs an uploaded document whose verificationStatus is exactly
        // VERIFIED - PENDING blocks verification exactly like REJECTED does, not just "present".
        List<String> unverifiedRequiredTypes = REQUIRED_DOCUMENT_TYPES.stream()
                .filter(required -> documents.stream()
                        .noneMatch(doc -> required.equalsIgnoreCase(doc.getDocumentType())
                                && "VERIFIED".equalsIgnoreCase(doc.getVerificationStatus())))
                .collect(Collectors.toList());

        if (!unverifiedRequiredTypes.isEmpty()) {
            throw new IllegalArgumentException(
                    "Cannot verify: the following required documents are missing or not yet individually verified: "
                            + String.join(", ", unverifiedRequiredTypes));
        }

        String recommendation;
        String reason;
        Integer creditScore = existing.getCreditScore() == null ? 0 : existing.getCreditScore();
        if (creditScore >= 700 && (existing.getVerifiedIncome() == null || existing.getVerifiedIncome().compareTo(new java.math.BigDecimal("30000")) >= 0)) {
            recommendation = "APPROVE";
            reason = "All required documents are verified and credit profile meets minimum criteria.";
        } else if (creditScore >= 650) {
            recommendation = "MANUAL_REVIEW";
            reason = "Application meets basic conditions but requires manual review.";
        } else {
            recommendation = "REJECT";
            reason = "Application does not meet minimum eligibility rules.";
        }

        existing.setStatus("Verified");
        existing.setRecommendation(recommendation);
        existing.setRecommendationReason(reason);
        existing.setUpdatedAt(LocalDateTime.now());

        LoanApplication updated = loanApplicationService.updateApplication(applicationId, existing);
        historyService.log(updated, caller, "PROCESSOR_VERIFIED",
                "Recommendation: " + recommendation + " - " + reason);
        return ResponseEntity.ok(updated);
    }
}
