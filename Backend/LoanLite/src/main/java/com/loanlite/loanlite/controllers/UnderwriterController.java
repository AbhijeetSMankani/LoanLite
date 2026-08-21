package com.loanlite.loanlite.controllers;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.loanlite.loanlite.entities.LoanApplication;
import com.loanlite.loanlite.entities.User;
import com.loanlite.loanlite.security.LoanApplicationAccessGuard;
import com.loanlite.loanlite.services.LoanApplicationService;

@RestController
@RequestMapping("/api/underwriter")
public class UnderwriterController {

    @Autowired
    private LoanApplicationService loanApplicationService;

    @Autowired
    private LoanApplicationAccessGuard accessGuard;

    // GET /api/underwriter/work-list
    // Returns applications waiting for an underwriter, i.e. those the processor has marked Ready for Underwriter.
    @GetMapping("/work-list")
    @PreAuthorize("hasRole('UNDERWRITER')")
    public ResponseEntity<List<LoanApplication>> getWorkList() {
        return ResponseEntity.ok(loanApplicationService.findByStatus("Ready for Underwriter"));
    }

    // POST /api/underwriter/claim/{applicationId}
    // Assigns the currently logged-in underwriter to the application and moves it into underwriting review.
    @PostMapping("/claim/{applicationId}")
    @PreAuthorize("hasRole('UNDERWRITER')")
    public ResponseEntity<LoanApplication> claimApplication(@PathVariable Long applicationId) {
        LoanApplication existing = loanApplicationService.getApplication(applicationId);
        if (existing.getStatus() == null || !existing.getStatus().equalsIgnoreCase("Ready for Underwriter")) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(existing);
        }

        User underwriter = accessGuard.currentUser();

        existing.setUnderwriter(underwriter);
        existing.setStatus("In Underwriting Review");
        existing.setUpdatedAt(LocalDateTime.now());
        return ResponseEntity.ok(loanApplicationService.updateApplication(applicationId, existing));
    }
}
