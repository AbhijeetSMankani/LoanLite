package com.loanlite.loanlite.controllers;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
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
    public ResponseEntity<List<LoanApplication>> getWorkList() {
        return ResponseEntity.ok(loanApplicationService.findByStatus("Verified"));
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
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
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
}
