package com.loanlite.loanlite.controllers;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.loanlite.loanlite.entities.LoanApplication;
import com.loanlite.loanlite.entities.User;
import com.loanlite.loanlite.exception.ApiException;
import com.loanlite.loanlite.security.LoanApplicationAccessGuard;
import com.loanlite.loanlite.services.ApplicationHistoryService;
import com.loanlite.loanlite.services.LoanApplicationService;

@RestController
@RequestMapping("/api/underwriter")
public class UnderwriterController {

    @Autowired
    private LoanApplicationService loanApplicationService;

    @Autowired
    private LoanApplicationAccessGuard accessGuard;

    @Autowired
    private ApplicationHistoryService historyService;

    // GET /api/underwriter/work-list
    // Returns applications waiting for an underwriter, i.e. those the processor has marked Verified.
    @GetMapping("/work-list")
    @PreAuthorize("hasRole('UNDERWRITER')")
    public ResponseEntity<Page<LoanApplication>> getWorkList(@PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(loanApplicationService.findByStatus("Verified", pageable));
    }

    // POST /api/underwriter/claim/{applicationId}
    // Assigns the currently logged-in underwriter to the application and moves it under review.
    // Uses an atomic conditional UPDATE (featuresTodo.csv task 6) instead of read-check-then-save:
    // two underwriters racing to claim the same application can no longer both pass the status
    // check before either write commits, since the WHERE clause re-checks status as part of the
    // same database write. The loser gets 409, not a silent 200.
    @PostMapping("/claim/{applicationId}")
    @PreAuthorize("hasRole('UNDERWRITER')")
    public ResponseEntity<LoanApplication> claimApplication(@PathVariable Long applicationId) {
        User underwriter = accessGuard.currentUser();
        Optional<LoanApplication> claimed = loanApplicationService.claimForUnderwriter(
                applicationId, "Verified", "Under Review", underwriter.getId());
        if (claimed.isEmpty()) {
            LoanApplication current = loanApplicationService.getApplication(applicationId);
            return ResponseEntity.status(HttpStatus.CONFLICT).body(current);
        }

        LoanApplication updated = claimed.get();
        historyService.log(updated, underwriter, "UNDERWRITER_CLAIMED",
                "Underwriter claimed the application for underwriting review.");
        return ResponseEntity.ok(updated);
    }

    // POST /api/underwriter/applications/{applicationId}/decision
    // Records the underwriter's final accept/reject decision - the actual approve/reject point of
    // the whole loan lifecycle, which didn't exist anywhere before this. Ownership-checked to the
    // assigned underwriter only (checked before the status precondition below, same order as every
    // other ownership+state check in this codebase - e.g. LoanApplicationController.update()'s
    // hasAccess() before its Draft-status check), and requires the application to currently be
    // Under Review.
    @PostMapping("/applications/{applicationId}/decision")
    @PreAuthorize("hasRole('UNDERWRITER')")
    public ResponseEntity<LoanApplication> decideApplication(
            @PathVariable Long applicationId,
            @RequestBody Map<String, String> payload) {
        LoanApplication existing = loanApplicationService.getApplication(applicationId);
        User caller = accessGuard.currentUser();
        if (!accessGuard.isAssignedUnderwriter(existing, caller)) {
            throw ApiException.forbidden("Only the assigned underwriter may record a decision on this application.");
        }
        if (existing.getStatus() == null || !existing.getStatus().equalsIgnoreCase("Under Review")) {
            throw new IllegalArgumentException(
                    "Cannot record a decision: application must be Under Review (current status: "
                            + existing.getStatus() + ")");
        }

        String decision = payload.get("decision");
        if (decision == null || (!decision.equalsIgnoreCase("ACCEPTED") && !decision.equalsIgnoreCase("REJECTED"))) {
            throw new IllegalArgumentException("decision must be ACCEPTED or REJECTED");
        }
        decision = decision.toUpperCase(Locale.ROOT);

        existing.setDecision(decision);
        existing.setDecisionComments(payload.get("comments"));
        existing.setStatus(decision.equals("ACCEPTED") ? "Accepted" : "Rejected");
        existing.setUpdatedAt(LocalDateTime.now());

        LoanApplication updated = loanApplicationService.updateApplication(applicationId, existing);
        historyService.log(updated, caller, decision.equals("ACCEPTED") ? "UNDERWRITER_ACCEPTED" : "UNDERWRITER_REJECTED",
                "Decision: " + decision + (existing.getDecisionComments() != null ? " - " + existing.getDecisionComments() : ""));
        return ResponseEntity.ok(updated);
    }

    // POST /api/underwriter/applications/{applicationId}/return-to-processor
    // Sends an application back to the processor when the underwriter finds something that needs
    // another look (a document that looks off, income that doesn't reconcile) rather than an
    // outright accept/reject (backendTodo.csv task 4). Same ownership+status-precondition pattern
    // as decideApplication() above: assigned-underwriter-only, checked before the Under Review
    // precondition, application must currently be Under Review. Status goes back to
    // "Under Verification" (reused, not a new status) and the processor assignment is left
    // untouched - the same processor who verified it gets it back, since the shared processor
    // work-list only shows "Submitted" applications and wouldn't surface this one to anyone else
    // anyway. The optional comment is stored in decisionComments, the same field
    // requestDocuments() uses for its optional message to the processor.
    @PostMapping("/applications/{applicationId}/return-to-processor")
    @PreAuthorize("hasRole('UNDERWRITER')")
    public ResponseEntity<LoanApplication> returnToProcessor(
            @PathVariable Long applicationId,
            @RequestBody(required = false) Map<String, String> payload) {
        LoanApplication existing = loanApplicationService.getApplication(applicationId);
        User caller = accessGuard.currentUser();
        if (!accessGuard.isAssignedUnderwriter(existing, caller)) {
            throw ApiException.forbidden("Only the assigned underwriter may return this application to the processor.");
        }
        if (existing.getStatus() == null || !existing.getStatus().equalsIgnoreCase("Under Review")) {
            throw new IllegalArgumentException(
                    "Cannot return to processor: application must be Under Review (current status: "
                            + existing.getStatus() + ")");
        }

        String comments = payload != null ? payload.get("comments") : null;
        existing.setStatus("Under Verification");
        if (comments != null) {
            existing.setDecisionComments(comments);
        }
        existing.setUpdatedAt(LocalDateTime.now());

        LoanApplication updated = loanApplicationService.updateApplication(applicationId, existing);
        historyService.log(updated, caller, "UNDERWRITER_RETURNED",
                comments != null ? comments : "Underwriter returned the application to the processor for another look.");
        return ResponseEntity.ok(updated);
    }
}
