package com.loanlite.loanlite.controllers;

import com.loanlite.loanlite.entities.Document;
import com.loanlite.loanlite.entities.LoanApplication;
import com.loanlite.loanlite.entities.User;
import com.loanlite.loanlite.exception.ApiException;
import com.loanlite.loanlite.security.LoanApplicationAccessGuard;
import com.loanlite.loanlite.services.ApplicationHistoryService;
import com.loanlite.loanlite.services.DocumentService;
import com.loanlite.loanlite.services.LoanApplicationService;
import com.loanlite.loanlite.services.OutsideCheckService;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class ProcessorControllerTest {

    @Mock
    private LoanApplicationService loanApplicationService;

    @Mock
    private DocumentService documentService;

    @Mock
    private LoanApplicationAccessGuard accessGuard;

    @Mock
    private ApplicationHistoryService historyService;

    @Mock
    private OutsideCheckService outsideCheckService;

    @InjectMocks
    private ProcessorController controller;

    private User user(Long id, String role) {
        User u = new User();
        u.setId(id);
        u.setRole(role);
        return u;
    }

    private List<Document> allRequiredVerifiedDocuments() {
        Document pan = new Document();
        pan.setDocumentType("PAN_CARD");
        pan.setVerificationStatus("VERIFIED");
        Document salary = new Document();
        salary.setDocumentType("SALARY_SLIP");
        salary.setVerificationStatus("VERIFIED");
        Document address = new Document();
        address.setDocumentType("ADDRESS_PROOF");
        address.setVerificationStatus("VERIFIED");
        return List.of(pan, salary, address);
    }

    // ---------- getWorkList ----------

    @Test
    void getWorkList_delegatesToFindByStatusSubmitted() {
        Pageable pageable = PageRequest.of(0, 20);
        when(loanApplicationService.findByStatus(eq("Submitted"), eq(pageable))).thenReturn(Page.empty());

        controller.getWorkList(pageable);

        verify(loanApplicationService).findByStatus("Submitted", pageable);
    }

    // ---------- claimApplication ----------

    @Test
    void claimApplication_returnsConflictWithCurrentApplicationWhenAlreadyClaimed() {
        User processor = user(7L, "ROLE_PROCESSOR");
        LoanApplication current = new LoanApplication();

        when(accessGuard.currentUser()).thenReturn(processor);
        when(loanApplicationService.claimForProcessor(1L, "Submitted", "Under Verification", 7L))
                .thenReturn(Optional.empty());
        when(loanApplicationService.getApplication(1L)).thenReturn(current);

        ResponseEntity<LoanApplication> resp = controller.claimApplication(1L);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(resp.getBody()).isEqualTo(current);
    }

    @Test
    void claimApplication_happyPath_persistsOutsideCheckResultsAndLogsHistory() {
        User processor = user(7L, "ROLE_PROCESSOR");
        LoanApplication claimed = new LoanApplication();

        when(accessGuard.currentUser()).thenReturn(processor);
        when(loanApplicationService.claimForProcessor(1L, "Submitted", "Under Verification", 7L))
                .thenReturn(Optional.of(claimed));
        when(outsideCheckService.fetchCreditScore()).thenReturn(750);
        when(outsideCheckService.fetchVerifiedIncome()).thenReturn(45000);
        when(loanApplicationService.updateApplication(eq(1L), any())).thenReturn(claimed);

        controller.claimApplication(1L);

        ArgumentCaptor<LoanApplication> captor = ArgumentCaptor.forClass(LoanApplication.class);
        verify(loanApplicationService).updateApplication(eq(1L), captor.capture());
        assertThat(captor.getValue().getCreditScore()).isEqualTo(750);
        assertThat(captor.getValue().getVerifiedIncome()).isEqualByComparingTo(BigDecimal.valueOf(45000));

        verify(historyService).log(eq(claimed), eq(processor), eq("PROCESSOR_CLAIMED"), any());
    }

    @Test
    void claimApplication_bothOutsideChecksFail_doesNotPersistAndStillLogsHistory() {
        User processor = user(7L, "ROLE_PROCESSOR");
        LoanApplication claimed = new LoanApplication();

        when(accessGuard.currentUser()).thenReturn(processor);
        when(loanApplicationService.claimForProcessor(1L, "Submitted", "Under Verification", 7L))
                .thenReturn(Optional.of(claimed));
        when(outsideCheckService.fetchCreditScore()).thenReturn(null);
        when(outsideCheckService.fetchVerifiedIncome()).thenReturn(null);

        ResponseEntity<LoanApplication> resp = controller.claimApplication(1L);

        verify(loanApplicationService, never()).updateApplication(anyLong(), any());
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isEqualTo(claimed);
        verify(historyService).log(eq(claimed), eq(processor), eq("PROCESSOR_CLAIMED"), any());
    }

    // ---------- verifyApplication ----------

    @Test
    void verifyApplication_notAssignedProcessorThrowsApiException() {
        LoanApplication existing = new LoanApplication();
        User caller = user(1L, "ROLE_PROCESSOR");

        when(loanApplicationService.getApplication(1L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAssignedProcessor(existing, caller)).thenReturn(false);

        assertThatThrownBy(() -> controller.verifyApplication(1L)).isInstanceOf(ApiException.class);
    }

    @Test
    void verifyApplication_missingVerifiedDocumentsThrowsIllegalArgumentException() {
        User caller = user(1L, "ROLE_PROCESSOR");
        LoanApplication existing = new LoanApplication();

        Document pan = new Document();
        pan.setDocumentType("PAN_CARD");
        pan.setVerificationStatus("VERIFIED");
        Document salary = new Document();
        salary.setDocumentType("SALARY_SLIP");
        salary.setVerificationStatus("PENDING");
        // ADDRESS_PROOF missing entirely

        when(loanApplicationService.getApplication(1L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAssignedProcessor(existing, caller)).thenReturn(true);
        when(documentService.findByApplicationId(1L)).thenReturn(List.of(pan, salary));

        assertThatThrownBy(() -> controller.verifyApplication(1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("SALARY_SLIP")
                .hasMessageContaining("ADDRESS_PROOF");
    }

    @Test
    void verifyApplication_highCreditScoreRecommendsApprove() {
        User caller = user(1L, "ROLE_PROCESSOR");
        LoanApplication existing = new LoanApplication();
        existing.setCreditScore(750);
        existing.setVerifiedIncome(null);
        existing.setEmi(null);

        when(loanApplicationService.getApplication(1L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAssignedProcessor(existing, caller)).thenReturn(true);
        when(documentService.findByApplicationId(1L)).thenReturn(allRequiredVerifiedDocuments());
        when(loanApplicationService.updateApplication(eq(1L), any())).thenReturn(existing);

        controller.verifyApplication(1L);

        assertThat(existing.getRecommendation()).isEqualTo("APPROVE");
        assertThat(existing.getStatus()).isEqualTo("Verified");
        verify(historyService).log(eq(existing), eq(caller), eq("PROCESSOR_VERIFIED"), any());
    }

    @Test
    void verifyApplication_midCreditScoreRecommendsManualReview() {
        User caller = user(1L, "ROLE_PROCESSOR");
        LoanApplication existing = new LoanApplication();
        existing.setCreditScore(680);
        existing.setEmi(null);

        when(loanApplicationService.getApplication(1L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAssignedProcessor(existing, caller)).thenReturn(true);
        when(documentService.findByApplicationId(1L)).thenReturn(allRequiredVerifiedDocuments());
        when(loanApplicationService.updateApplication(eq(1L), any())).thenReturn(existing);

        controller.verifyApplication(1L);

        assertThat(existing.getRecommendation()).isEqualTo("MANUAL_REVIEW");
        verify(historyService).log(eq(existing), eq(caller), eq("PROCESSOR_VERIFIED"), any());
    }

    @Test
    void verifyApplication_lowCreditScoreRecommendsReject() {
        User caller = user(1L, "ROLE_PROCESSOR");
        LoanApplication existing = new LoanApplication();
        existing.setCreditScore(600);
        existing.setEmi(null);

        when(loanApplicationService.getApplication(1L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAssignedProcessor(existing, caller)).thenReturn(true);
        when(documentService.findByApplicationId(1L)).thenReturn(allRequiredVerifiedDocuments());
        when(loanApplicationService.updateApplication(eq(1L), any())).thenReturn(existing);

        controller.verifyApplication(1L);

        assertThat(existing.getRecommendation()).isEqualTo("REJECT");
        verify(historyService).log(eq(existing), eq(caller), eq("PROCESSOR_VERIFIED"), any());
    }

    @Test
    void verifyApplication_nullCreditScoreTreatedAsZeroRecommendsReject() {
        User caller = user(1L, "ROLE_PROCESSOR");
        LoanApplication existing = new LoanApplication();
        existing.setCreditScore(null);
        existing.setEmi(null);

        when(loanApplicationService.getApplication(1L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAssignedProcessor(existing, caller)).thenReturn(true);
        when(documentService.findByApplicationId(1L)).thenReturn(allRequiredVerifiedDocuments());
        when(loanApplicationService.updateApplication(eq(1L), any())).thenReturn(existing);

        controller.verifyApplication(1L);

        assertThat(existing.getRecommendation()).isEqualTo("REJECT");
    }
}
