package com.loanlite.loanlite.controllers;

import com.loanlite.loanlite.entities.Document;
import com.loanlite.loanlite.entities.LoanApplication;
import com.loanlite.loanlite.entities.User;
import com.loanlite.loanlite.exception.ApiException;
import com.loanlite.loanlite.security.LoanApplicationAccessGuard;
import com.loanlite.loanlite.services.ApplicationHistoryService;
import com.loanlite.loanlite.services.DocumentService;
import com.loanlite.loanlite.services.LoanApplicationService;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.InjectMocks;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class LoanApplicationControllerTest {

    @Mock
    private LoanApplicationService service;

    @Mock
    private DocumentService documentService;

    @Mock
    private LoanApplicationAccessGuard accessGuard;

    @Mock
    private ApplicationHistoryService historyService;

    @InjectMocks
    private LoanApplicationController controller;

    // uploadDocument() writes directly to disk (Files.createDirectories/Files.copy) rather than
    // through a mockable collaborator, so the happy-path test below genuinely creates a file.
    // Tracked here so it can be deleted afterward instead of accumulating on every test run.
    private Path uploadedFilePathToCleanUp;

    @AfterEach
    void cleanUpAnyUploadedFile() throws IOException {
        if (uploadedFilePathToCleanUp != null) {
            Files.deleteIfExists(uploadedFilePathToCleanUp);
            Path parentDir = uploadedFilePathToCleanUp.getParent();
            try (var entries = Files.list(parentDir)) {
                if (entries.findAny().isEmpty()) {
                    Files.deleteIfExists(parentDir);
                }
            }
        }
    }

    private User user(Long id, String role) {
        User u = new User();
        u.setId(id);
        u.setRole(role);
        return u;
    }

    // ---------- create ----------

    @Test
    void create_forcesStaffOnlyFieldsAndOverridesApplicant() {
        User caller = user(1L, "ROLE_USER");
        User someoneElse = user(99L, "ROLE_USER");
        User processor = user(5L, "ROLE_PROCESSOR");

        LoanApplication app = new LoanApplication();
        app.setApplicant(someoneElse);
        app.setStatus("Accepted");
        app.setRecommendation("APPROVE");
        app.setProcessor(processor);
        app.setCreditScore(780);
        app.setCreatedAt(LocalDateTime.now().minusDays(30));
        app.setApplicationNumber("APP-EXISTING");

        when(accessGuard.currentUser()).thenReturn(caller);
        when(service.createApplication(any())).thenAnswer(invocation -> invocation.getArgument(0));

        ResponseEntity<LoanApplication> resp = controller.create(app);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        LoanApplication created = resp.getBody();
        assertThat(created).isNotNull();
        assertThat(created.getStatus()).isEqualTo("Draft");
        assertThat(created.getRecommendation()).isNull();
        assertThat(created.getProcessor()).isNull();
        assertThat(created.getCreditScore()).isNull();
        assertThat(created.getCreatedAt()).isNull();
        assertThat(created.getInterestRate()).isEqualByComparingTo(LoanApplicationService.FIXED_ANNUAL_INTEREST_RATE);
        assertThat(created.getApplicant()).isEqualTo(caller);
    }

    @Test
    void create_autoGeneratesApplicationNumberWhenBlank() {
        User caller = user(1L, "ROLE_USER");
        LoanApplication app = new LoanApplication();
        app.setApplicationNumber(null);

        when(accessGuard.currentUser()).thenReturn(caller);
        when(service.createApplication(any())).thenAnswer(invocation -> invocation.getArgument(0));

        ResponseEntity<LoanApplication> resp = controller.create(app);

        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().getApplicationNumber()).startsWith("APP-");
    }

    // ---------- list ----------

    @Test
    void list_nonAdminProcessorForcesOwnProcessorId() {
        User caller = user(5L, "ROLE_PROCESSOR");
        Pageable pageable = PageRequest.of(0, 20);

        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAdmin(caller)).thenReturn(false);
        when(accessGuard.isProcessorRole(caller)).thenReturn(true);

        controller.list(null, 99L, null, null, pageable);

        ArgumentCaptor<Long> processorIdCaptor = ArgumentCaptor.forClass(Long.class);
        verify(service).search(isNull(), processorIdCaptor.capture(), isNull(), isNull(), eq(pageable));
        assertThat(processorIdCaptor.getValue()).isEqualTo(5L);
    }

    @Test
    void list_adminForwardsAllFiltersUnchanged() {
        User caller = user(1L, "ROLE_ADMIN");
        Pageable pageable = PageRequest.of(0, 20);

        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAdmin(caller)).thenReturn(true);

        controller.list("Submitted", 10L, 20L, 30L, pageable);

        verify(service).search(eq("Submitted"), eq(10L), eq(20L), eq(30L), eq(pageable));
    }

    // ---------- getApplication ----------

    @Test
    void getApplication_noAccessThrowsApiException() {
        LoanApplication app = new LoanApplication();
        User caller = user(1L, "ROLE_USER");

        when(service.getApplication(1L)).thenReturn(app);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.hasAccess(app, caller)).thenReturn(false);

        assertThatThrownBy(() -> controller.getApplication(1L)).isInstanceOf(ApiException.class);
    }

    @Test
    void getApplication_hasAccessReturns200WithBody() {
        LoanApplication app = new LoanApplication();
        User caller = user(1L, "ROLE_USER");

        when(service.getApplication(1L)).thenReturn(app);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.hasAccess(app, caller)).thenReturn(true);

        ResponseEntity<LoanApplication> resp = controller.getApplication(1L);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isEqualTo(app);
    }

    // ---------- getByApplicationNumber ----------

    @Test
    void getByApplicationNumber_notFoundThrowsApiException() {
        when(service.findByApplicationNumber("APP-1")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> controller.getByApplicationNumber("APP-1")).isInstanceOf(ApiException.class);
    }

    @Test
    void getByApplicationNumber_foundNoAccessThrowsApiException() {
        LoanApplication app = new LoanApplication();
        User caller = user(1L, "ROLE_USER");

        when(service.findByApplicationNumber("APP-1")).thenReturn(Optional.of(app));
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.hasAccess(app, caller)).thenReturn(false);

        assertThatThrownBy(() -> controller.getByApplicationNumber("APP-1")).isInstanceOf(ApiException.class);
    }

    @Test
    void getByApplicationNumber_foundWithAccessReturns200() {
        LoanApplication app = new LoanApplication();
        User caller = user(1L, "ROLE_USER");

        when(service.findByApplicationNumber("APP-1")).thenReturn(Optional.of(app));
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.hasAccess(app, caller)).thenReturn(true);

        ResponseEntity<LoanApplication> resp = controller.getByApplicationNumber("APP-1");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isEqualTo(app);
    }

    // ---------- update ----------

    @Test
    void update_noAccessThrowsApiException() {
        LoanApplication existing = new LoanApplication();
        User caller = user(1L, "ROLE_USER");

        when(service.getApplication(1L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.hasAccess(existing, caller)).thenReturn(false);

        assertThatThrownBy(() -> controller.update(1L, new LoanApplication())).isInstanceOf(ApiException.class);
    }

    @Test
    void update_owningApplicantEditingNonDraftThrowsApiException() {
        LoanApplication existing = new LoanApplication();
        existing.setStatus("Submitted");
        User caller = user(1L, "ROLE_USER");

        when(service.getApplication(1L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.hasAccess(existing, caller)).thenReturn(true);
        when(accessGuard.isOwningApplicant(existing, caller)).thenReturn(true);

        LoanApplication incoming = new LoanApplication();
        assertThatThrownBy(() -> controller.update(1L, incoming)).isInstanceOf(ApiException.class);
    }

    @Test
    void update_loanAmountOutOfRangeThrowsBadRequest() {
        LoanApplication existing = new LoanApplication();
        existing.setStatus("Draft");
        User caller = user(1L, "ROLE_USER");

        when(service.getApplication(1L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.hasAccess(existing, caller)).thenReturn(true);

        LoanApplication incoming = new LoanApplication();
        incoming.setLoanAmount(new BigDecimal("1000"));

        assertThatThrownBy(() -> controller.update(1L, incoming))
                .isInstanceOf(ApiException.class)
                .satisfies(ex -> assertThat(((ApiException) ex).getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void update_invalidTenureMonthsThrowsBadRequest() {
        LoanApplication existing = new LoanApplication();
        existing.setStatus("Draft");
        User caller = user(1L, "ROLE_USER");

        when(service.getApplication(1L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.hasAccess(existing, caller)).thenReturn(true);

        LoanApplication incoming = new LoanApplication();
        incoming.setTenureMonths(15);

        assertThatThrownBy(() -> controller.update(1L, incoming))
                .isInstanceOf(ApiException.class)
                .satisfies(ex -> assertThat(((ApiException) ex).getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void update_declaredIncomeNotPositiveThrowsBadRequest() {
        LoanApplication existing = new LoanApplication();
        existing.setStatus("Draft");
        User caller = user(1L, "ROLE_USER");

        when(service.getApplication(1L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.hasAccess(existing, caller)).thenReturn(true);

        LoanApplication incoming = new LoanApplication();
        incoming.setDeclaredIncome(BigDecimal.ZERO);

        assertThatThrownBy(() -> controller.update(1L, incoming))
                .isInstanceOf(ApiException.class)
                .satisfies(ex -> assertThat(((ApiException) ex).getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void update_owningApplicantHappyPath_forcesStatusNullAndCopiesStaffFieldsFromExisting() {
        User caller = user(1L, "ROLE_USER");
        User existingProcessor = user(5L, "ROLE_PROCESSOR");
        User existingUnderwriter = user(6L, "ROLE_UNDERWRITER");

        LoanApplication existing = new LoanApplication();
        existing.setStatus("Draft");
        existing.setRecommendation("APPROVE");
        existing.setRecommendationReason("Existing reason");
        existing.setDecision("ACCEPTED");
        existing.setDecisionComments("Existing comments");
        existing.setProcessor(existingProcessor);
        existing.setUnderwriter(existingUnderwriter);
        existing.setCreditScore(750);
        existing.setVerifiedIncome(new BigDecimal("40000"));

        when(service.getApplication(1L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.hasAccess(existing, caller)).thenReturn(true);
        when(accessGuard.isOwningApplicant(existing, caller)).thenReturn(true);

        LoanApplication incoming = new LoanApplication();
        incoming.setStatus("Submitted");
        incoming.setRecommendation("REJECT");
        incoming.setProcessor(null);
        incoming.setUnderwriter(null);
        incoming.setCreditScore(600);
        incoming.setVerifiedIncome(new BigDecimal("10000"));

        controller.update(1L, incoming);

        ArgumentCaptor<LoanApplication> captor = ArgumentCaptor.forClass(LoanApplication.class);
        verify(service).updateApplication(eq(1L), captor.capture());
        LoanApplication passed = captor.getValue();

        assertThat(passed.getStatus()).isNull();
        assertThat(passed.getRecommendation()).isEqualTo("APPROVE");
        assertThat(passed.getDecision()).isEqualTo("ACCEPTED");
        assertThat(passed.getProcessor()).isEqualTo(existingProcessor);
        assertThat(passed.getUnderwriter()).isEqualTo(existingUnderwriter);
        assertThat(passed.getCreditScore()).isEqualTo(750);
        assertThat(passed.getVerifiedIncome()).isEqualByComparingTo(new BigDecimal("40000"));
        assertThat(passed.getInterestRate()).isEqualByComparingTo(LoanApplicationService.FIXED_ANNUAL_INTEREST_RATE);
    }

    @Test
    void update_staffHappyPath_doesNotApplyApplicantOnlyRestrictions() {
        User caller = user(5L, "ROLE_PROCESSOR");
        User applicant = user(1L, "ROLE_USER");

        LoanApplication existing = new LoanApplication();
        existing.setStatus("Under Verification");
        existing.setApplicant(applicant);
        existing.setProcessor(caller);

        when(service.getApplication(1L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.hasAccess(existing, caller)).thenReturn(true);
        when(accessGuard.isOwningApplicant(existing, caller)).thenReturn(false);

        LoanApplication incoming = new LoanApplication();
        incoming.setStatus("Verified");
        incoming.setRecommendation("MANUAL_REVIEW");

        controller.update(1L, incoming);

        ArgumentCaptor<LoanApplication> captor = ArgumentCaptor.forClass(LoanApplication.class);
        verify(service).updateApplication(eq(1L), captor.capture());
        LoanApplication passed = captor.getValue();

        assertThat(passed.getStatus()).isEqualTo("Verified");
        assertThat(passed.getRecommendation()).isEqualTo("MANUAL_REVIEW");
        assertThat(passed.getInterestRate()).isEqualByComparingTo(LoanApplicationService.FIXED_ANNUAL_INTEREST_RATE);
    }

    // ---------- submitApplication ----------

    @Test
    void submitApplication_nonOwningCallerThrowsApiException() {
        LoanApplication existing = new LoanApplication();
        User caller = user(1L, "ROLE_USER");

        when(service.getApplication(1L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isOwningApplicant(existing, caller)).thenReturn(false);

        assertThatThrownBy(() -> controller.submitApplication(1L)).isInstanceOf(ApiException.class);
    }

    @Test
    void submitApplication_owningHappyPath_setsSubmittedStatusAndLogsHistory() {
        LoanApplication existing = new LoanApplication();
        existing.setStatus("Draft");
        existing.setSubmittedAt(null);
        User caller = user(1L, "ROLE_USER");

        when(service.getApplication(1L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isOwningApplicant(existing, caller)).thenReturn(true);
        when(service.updateApplication(eq(1L), any())).thenReturn(existing);

        controller.submitApplication(1L);

        assertThat(existing.getStatus()).isEqualTo("Submitted");
        assertThat(existing.getSubmittedAt()).isNotNull();
        verify(historyService).log(eq(existing), eq(caller), eq("SUBMITTED"), any());
    }

    // ---------- withdrawApplication ----------

    @Test
    void withdrawApplication_nonOwningCallerThrowsApiException() {
        LoanApplication existing = new LoanApplication();
        User caller = user(1L, "ROLE_USER");

        when(service.getApplication(1L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isOwningApplicant(existing, caller)).thenReturn(false);

        assertThatThrownBy(() -> controller.withdrawApplication(1L)).isInstanceOf(ApiException.class);
    }

    @Test
    void withdrawApplication_owningHappyPath_setsWithdrawnStatusAndLogsHistory() {
        LoanApplication existing = new LoanApplication();
        existing.setStatus("Draft");
        User caller = user(1L, "ROLE_USER");

        when(service.getApplication(1L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isOwningApplicant(existing, caller)).thenReturn(true);
        when(service.updateApplication(eq(1L), any())).thenReturn(existing);

        controller.withdrawApplication(1L);

        assertThat(existing.getStatus()).isEqualTo("Withdrawn");
        verify(historyService).log(eq(existing), eq(caller), eq("WITHDRAWN"), any());
    }

    // ---------- uploadDocument ----------

    @Test
    void uploadDocument_noAccessThrowsApiException() {
        LoanApplication application = new LoanApplication();
        User caller = user(1L, "ROLE_USER");

        when(service.getApplication(1L)).thenReturn(application);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.hasAccess(application, caller)).thenReturn(false);

        MockMultipartFile file = new MockMultipartFile("file", "a.pdf", "application/pdf", "hello".getBytes());

        assertThatThrownBy(() -> controller.uploadDocument(1L, file, "PAN_CARD", null))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void uploadDocument_emptyFileThrowsBadRequest() throws Exception {
        LoanApplication application = new LoanApplication();
        User caller = user(1L, "ROLE_USER");

        when(service.getApplication(1L)).thenReturn(application);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.hasAccess(application, caller)).thenReturn(true);

        MockMultipartFile emptyFile = new MockMultipartFile("file", "empty.pdf", "application/pdf", new byte[0]);

        assertThatThrownBy(() -> controller.uploadDocument(1L, emptyFile, "PAN_CARD", null))
                .isInstanceOf(ApiException.class)
                .satisfies(ex -> assertThat(((ApiException) ex).getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void uploadDocument_disallowedContentTypeThrowsIllegalArgumentException() {
        LoanApplication application = new LoanApplication();
        User caller = user(1L, "ROLE_USER");

        when(service.getApplication(1L)).thenReturn(application);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.hasAccess(application, caller)).thenReturn(true);

        MockMultipartFile file = new MockMultipartFile("file", "a.html", "text/html", "hello".getBytes());

        assertThatThrownBy(() -> controller.uploadDocument(1L, file, "PAN_CARD", null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void uploadDocument_happyPath_createsDocumentWithPendingStatus() throws Exception {
        LoanApplication application = new LoanApplication();
        application.setStatus("Draft");
        User caller = user(1L, "ROLE_USER");

        when(service.getApplication(1L)).thenReturn(application);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.hasAccess(application, caller)).thenReturn(true);
        when(documentService.createDocument(any())).thenAnswer(invocation -> invocation.getArgument(0));

        MockMultipartFile file = new MockMultipartFile("file", "doc.pdf", "application/pdf", "hello world".getBytes());

        ResponseEntity<Document> resp = controller.uploadDocument(1L, file, "PAN_CARD", null);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(documentService).createDocument(captor.capture());
        assertThat(captor.getValue().getVerificationStatus()).isEqualTo("PENDING");
        assertThat(captor.getValue().getDocumentType()).isEqualTo("PAN_CARD");

        uploadedFilePathToCleanUp = Paths.get(captor.getValue().getFilePath());
    }

    // ---------- getApplicationDocuments ----------

    @Test
    void getApplicationDocuments_noAccessThrowsApiException() {
        LoanApplication application = new LoanApplication();
        User caller = user(1L, "ROLE_USER");

        when(service.getApplication(1L)).thenReturn(application);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.hasAccess(application, caller)).thenReturn(false);

        assertThatThrownBy(() -> controller.getApplicationDocuments(1L)).isInstanceOf(ApiException.class);
    }

    @Test
    void getApplicationDocuments_happyPath_reportsMissingRequiredDocuments() {
        LoanApplication application = new LoanApplication();
        User caller = user(1L, "ROLE_USER");

        Document panCard = new Document();
        panCard.setDocumentType("PAN_CARD");

        when(service.getApplication(1L)).thenReturn(application);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.hasAccess(application, caller)).thenReturn(true);
        when(documentService.findByApplicationId(1L)).thenReturn(List.of(panCard));

        ResponseEntity<Map<String, Object>> resp = controller.getApplicationDocuments(1L);

        @SuppressWarnings("unchecked")
        List<String> missing = (List<String>) resp.getBody().get("missingRequiredDocuments");
        assertThat(missing).containsExactlyInAnyOrder("SALARY_SLIP", "ADDRESS_PROOF");
    }

    // ---------- delete ----------

    @Test
    void delete_delegatesToServiceAndReturns204() {
        ResponseEntity<Void> resp = controller.delete(1L);

        verify(service).deleteApplication(1L);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }
}
