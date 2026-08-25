package com.loanlite.loanlite.controllers;

import com.loanlite.loanlite.entities.LoanApplication;
import com.loanlite.loanlite.entities.User;
import com.loanlite.loanlite.exception.ApiException;
import com.loanlite.loanlite.security.LoanApplicationAccessGuard;
import com.loanlite.loanlite.services.ApplicationHistoryService;
import com.loanlite.loanlite.services.LoanApplicationService;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class UnderwriterControllerTest {

    @Mock
    private LoanApplicationService loanApplicationService;

    @Mock
    private LoanApplicationAccessGuard accessGuard;

    @Mock
    private ApplicationHistoryService historyService;

    @InjectMocks
    private UnderwriterController controller;

    private User user(Long id, String role) {
        User u = new User();
        u.setId(id);
        u.setRole(role);
        return u;
    }

    // ---------- getWorkList ----------

    @Test
    void getWorkList_delegatesToFindByStatusVerified() {
        Pageable pageable = PageRequest.of(0, 20);
        when(loanApplicationService.findByStatus(eq("Verified"), eq(pageable))).thenReturn(Page.empty());

        controller.getWorkList(pageable);

        verify(loanApplicationService).findByStatus("Verified", pageable);
    }

    // ---------- claimApplication ----------

    @Test
    void claimApplication_returnsConflictWithCurrentApplicationWhenAlreadyClaimed() {
        User underwriter = user(8L, "ROLE_UNDERWRITER");
        LoanApplication current = new LoanApplication();

        when(accessGuard.currentUser()).thenReturn(underwriter);
        when(loanApplicationService.claimForUnderwriter(1L, "Verified", "Under Review", 8L))
                .thenReturn(Optional.empty());
        when(loanApplicationService.getApplication(1L)).thenReturn(current);

        ResponseEntity<LoanApplication> resp = controller.claimApplication(1L);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(resp.getBody()).isEqualTo(current);
    }

    @Test
    void claimApplication_happyPath_returns200AndLogsHistory() {
        User underwriter = user(8L, "ROLE_UNDERWRITER");
        LoanApplication claimed = new LoanApplication();

        when(accessGuard.currentUser()).thenReturn(underwriter);
        when(loanApplicationService.claimForUnderwriter(1L, "Verified", "Under Review", 8L))
                .thenReturn(Optional.of(claimed));

        ResponseEntity<LoanApplication> resp = controller.claimApplication(1L);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isEqualTo(claimed);
        verify(historyService).log(eq(claimed), eq(underwriter), eq("UNDERWRITER_CLAIMED"), any());
    }

    // ---------- decideApplication ----------

    @Test
    void decideApplication_notAssignedUnderwriterThrowsApiException() {
        LoanApplication existing = new LoanApplication();
        User caller = user(1L, "ROLE_UNDERWRITER");

        when(loanApplicationService.getApplication(1L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAssignedUnderwriter(existing, caller)).thenReturn(false);

        assertThatThrownBy(() -> controller.decideApplication(1L, Map.of("decision", "ACCEPTED")))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void decideApplication_statusNotUnderReviewThrowsIllegalArgumentException() {
        LoanApplication existing = new LoanApplication();
        existing.setStatus("Draft");
        User caller = user(1L, "ROLE_UNDERWRITER");

        when(loanApplicationService.getApplication(1L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAssignedUnderwriter(existing, caller)).thenReturn(true);

        assertThatThrownBy(() -> controller.decideApplication(1L, Map.of("decision", "ACCEPTED")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void decideApplication_missingDecisionThrowsIllegalArgumentException() {
        LoanApplication existing = new LoanApplication();
        existing.setStatus("Under Review");
        User caller = user(1L, "ROLE_UNDERWRITER");

        when(loanApplicationService.getApplication(1L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAssignedUnderwriter(existing, caller)).thenReturn(true);

        assertThatThrownBy(() -> controller.decideApplication(1L, Collections.emptyMap()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void decideApplication_invalidDecisionValueThrowsIllegalArgumentException() {
        LoanApplication existing = new LoanApplication();
        existing.setStatus("Under Review");
        User caller = user(1L, "ROLE_UNDERWRITER");

        when(loanApplicationService.getApplication(1L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAssignedUnderwriter(existing, caller)).thenReturn(true);

        assertThatThrownBy(() -> controller.decideApplication(1L, Map.of("decision", "MAYBE")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void decideApplication_acceptedLowercaseHappyPath_isUppercasedAndLogged() {
        LoanApplication existing = new LoanApplication();
        existing.setStatus("Under Review");
        User caller = user(1L, "ROLE_UNDERWRITER");

        when(loanApplicationService.getApplication(1L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAssignedUnderwriter(existing, caller)).thenReturn(true);
        when(loanApplicationService.updateApplication(eq(1L), any())).thenReturn(existing);

        Map<String, String> payload = new HashMap<>();
        payload.put("decision", "accepted");
        payload.put("comments", "Looks good");

        controller.decideApplication(1L, payload);

        assertThat(existing.getStatus()).isEqualTo("Accepted");
        assertThat(existing.getDecision()).isEqualTo("ACCEPTED");
        verify(historyService).log(eq(existing), eq(caller), eq("UNDERWRITER_ACCEPTED"), any());
    }

    @Test
    void decideApplication_rejectedHappyPath_setsRejectedStatusAndLogs() {
        LoanApplication existing = new LoanApplication();
        existing.setStatus("Under Review");
        User caller = user(1L, "ROLE_UNDERWRITER");

        when(loanApplicationService.getApplication(1L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAssignedUnderwriter(existing, caller)).thenReturn(true);
        when(loanApplicationService.updateApplication(eq(1L), any())).thenReturn(existing);

        Map<String, String> payload = new HashMap<>();
        payload.put("decision", "REJECTED");

        controller.decideApplication(1L, payload);

        assertThat(existing.getStatus()).isEqualTo("Rejected");
        assertThat(existing.getDecision()).isEqualTo("REJECTED");
        verify(historyService).log(eq(existing), eq(caller), eq("UNDERWRITER_REJECTED"), any());
    }

    // ---------- returnToProcessor ----------

    @Test
    void returnToProcessor_notAssignedUnderwriterThrowsApiException() {
        LoanApplication existing = new LoanApplication();
        User caller = user(1L, "ROLE_UNDERWRITER");

        when(loanApplicationService.getApplication(1L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAssignedUnderwriter(existing, caller)).thenReturn(false);

        assertThatThrownBy(() -> controller.returnToProcessor(1L, null)).isInstanceOf(ApiException.class);
    }

    @Test
    void returnToProcessor_statusNotUnderReviewThrowsIllegalArgumentException() {
        LoanApplication existing = new LoanApplication();
        existing.setStatus("Draft");
        User caller = user(1L, "ROLE_UNDERWRITER");

        when(loanApplicationService.getApplication(1L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAssignedUnderwriter(existing, caller)).thenReturn(true);

        assertThatThrownBy(() -> controller.returnToProcessor(1L, null)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void returnToProcessor_happyPathWithComments_setsCommentsAndLogsThem() {
        LoanApplication existing = new LoanApplication();
        existing.setStatus("Under Review");
        User caller = user(1L, "ROLE_UNDERWRITER");

        when(loanApplicationService.getApplication(1L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAssignedUnderwriter(existing, caller)).thenReturn(true);
        when(loanApplicationService.updateApplication(eq(1L), any())).thenReturn(existing);

        Map<String, String> payload = new HashMap<>();
        payload.put("comments", "Please recheck income");

        controller.returnToProcessor(1L, payload);

        assertThat(existing.getStatus()).isEqualTo("Under Verification");
        assertThat(existing.getDecisionComments()).isEqualTo("Please recheck income");
        verify(historyService).log(eq(existing), eq(caller), eq("UNDERWRITER_RETURNED"), eq("Please recheck income"));
    }

    @Test
    void returnToProcessor_happyPathWithNullPayload_logsFallbackMessage() {
        LoanApplication existing = new LoanApplication();
        existing.setStatus("Under Review");
        User caller = user(1L, "ROLE_UNDERWRITER");

        when(loanApplicationService.getApplication(1L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAssignedUnderwriter(existing, caller)).thenReturn(true);
        when(loanApplicationService.updateApplication(eq(1L), any())).thenReturn(existing);

        controller.returnToProcessor(1L, null);

        assertThat(existing.getStatus()).isEqualTo("Under Verification");
        verify(historyService).log(eq(existing), eq(caller), eq("UNDERWRITER_RETURNED"),
                eq("Underwriter returned the application to the processor for another look."));
    }
}
