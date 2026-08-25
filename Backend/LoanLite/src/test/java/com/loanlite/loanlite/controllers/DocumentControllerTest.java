package com.loanlite.loanlite.controllers;

import com.loanlite.loanlite.entities.Document;
import com.loanlite.loanlite.entities.LoanApplication;
import com.loanlite.loanlite.entities.User;
import com.loanlite.loanlite.exception.ApiException;
import com.loanlite.loanlite.security.LoanApplicationAccessGuard;
import com.loanlite.loanlite.services.ApplicationHistoryService;
import com.loanlite.loanlite.services.DocumentService;
import com.loanlite.loanlite.services.LoanApplicationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DocumentControllerTest {

    @Mock
    private DocumentService service;

    @Mock
    private LoanApplicationService loanApplicationService;

    @Mock
    private LoanApplicationAccessGuard accessGuard;

    @Mock
    private ApplicationHistoryService historyService;

    @InjectMocks
    private DocumentController controller;

    private User user(Long id, String role) {
        User u = new User();
        u.setId(id);
        u.setRole(role);
        return u;
    }

    // ---------- create ----------

    @Test
    void createDelegatesToServiceAndReturns201() {
        Document doc = new Document();
        Document saved = new Document();
        saved.setId(1L);
        when(service.createDocument(doc)).thenReturn(saved);

        ResponseEntity<Document> resp = controller.create(doc);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(resp.getBody()).isSameAs(saved);
        verify(service).createDocument(doc);
    }

    // ---------- get ----------

    @Test
    void getThrowsApiExceptionWhenCallerHasNoAccess() {
        LoanApplication app = new LoanApplication();
        Document doc = new Document();
        doc.setId(5L);
        doc.setApplication(app);
        User caller = user(1L, "ROLE_USER");

        when(service.getDocument(5L)).thenReturn(doc);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.hasAccess(app, caller)).thenReturn(false);

        assertThatThrownBy(() -> controller.get(5L)).isInstanceOf(ApiException.class);
    }

    @Test
    void getReturns200WhenCallerHasAccess() {
        LoanApplication app = new LoanApplication();
        Document doc = new Document();
        doc.setId(5L);
        doc.setApplication(app);
        User caller = user(1L, "ROLE_USER");

        when(service.getDocument(5L)).thenReturn(doc);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.hasAccess(app, caller)).thenReturn(true);

        ResponseEntity<Document> resp = controller.get(5L);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isSameAs(doc);
    }

    // ---------- list ----------

    @Test
    void listDelegatesToServiceWithCallerIdAndAdminFlag() {
        User caller = user(7L, "ROLE_USER");
        Pageable pageable = mock(Pageable.class);
        Page<Document> page = new PageImpl<>(List.of());

        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAdmin(caller)).thenReturn(false);
        when(service.listVisibleTo(7L, false, pageable)).thenReturn(page);

        ResponseEntity<Page<Document>> resp = controller.list(pageable);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isSameAs(page);
        verify(service).listVisibleTo(7L, false, pageable);
    }

    // ---------- update ----------

    @Test
    void updateAllowedForAdmin() {
        LoanApplication app = new LoanApplication();
        Document existing = new Document();
        existing.setApplication(app);
        User caller = user(1L, "ROLE_ADMIN");
        Document body = new Document();
        Document updated = new Document();

        when(service.getDocument(10L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAdmin(caller)).thenReturn(true);
        when(service.updateDocument(10L, body)).thenReturn(updated);

        ResponseEntity<Document> resp = controller.update(10L, body);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isSameAs(updated);
    }

    @Test
    void updateAllowedForAssignedProcessor() {
        LoanApplication app = new LoanApplication();
        Document existing = new Document();
        existing.setApplication(app);
        User caller = user(2L, "ROLE_PROCESSOR");
        Document body = new Document();
        Document updated = new Document();

        when(service.getDocument(10L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAdmin(caller)).thenReturn(false);
        when(accessGuard.isAssignedProcessor(app, caller)).thenReturn(true);
        when(service.updateDocument(10L, body)).thenReturn(updated);

        ResponseEntity<Document> resp = controller.update(10L, body);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isSameAs(updated);
    }

    @Test
    void updateAllowedForAssignedUnderwriter() {
        LoanApplication app = new LoanApplication();
        Document existing = new Document();
        existing.setApplication(app);
        User caller = user(3L, "ROLE_UNDERWRITER");
        Document body = new Document();
        Document updated = new Document();

        when(service.getDocument(10L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAdmin(caller)).thenReturn(false);
        when(accessGuard.isAssignedProcessor(app, caller)).thenReturn(false);
        when(accessGuard.isAssignedUnderwriter(app, caller)).thenReturn(true);
        when(service.updateDocument(10L, body)).thenReturn(updated);

        ResponseEntity<Document> resp = controller.update(10L, body);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isSameAs(updated);
    }

    @Test
    void updateThrowsApiExceptionWhenCallerIsNoneOfTheAllowedRoles() {
        LoanApplication app = new LoanApplication();
        Document existing = new Document();
        existing.setApplication(app);
        User caller = user(4L, "ROLE_USER");
        Document body = new Document();

        when(service.getDocument(10L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAdmin(caller)).thenReturn(false);
        when(accessGuard.isAssignedProcessor(app, caller)).thenReturn(false);
        when(accessGuard.isAssignedUnderwriter(app, caller)).thenReturn(false);

        assertThatThrownBy(() -> controller.update(10L, body)).isInstanceOf(ApiException.class);
    }

    // ---------- delete ----------

    @Test
    void deleteAllowedForAdminRegardlessOfStatus() {
        LoanApplication app = new LoanApplication();
        Document doc = new Document();
        doc.setApplication(app);
        doc.setVerificationStatus("VERIFIED");
        User caller = user(1L, "ROLE_ADMIN");

        when(service.getDocument(10L)).thenReturn(doc);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAdmin(caller)).thenReturn(true);

        ResponseEntity<Void> resp = controller.delete(10L);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(service).deleteDocument(10L);
    }

    @Test
    void deleteAllowedForOwningApplicantWhenPending() {
        LoanApplication app = new LoanApplication();
        Document doc = new Document();
        doc.setApplication(app);
        doc.setVerificationStatus("PENDING");
        User caller = user(5L, "ROLE_USER");

        when(service.getDocument(10L)).thenReturn(doc);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAdmin(caller)).thenReturn(false);
        when(accessGuard.isOwningApplicant(app, caller)).thenReturn(true);

        ResponseEntity<Void> resp = controller.delete(10L);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(service).deleteDocument(10L);
    }

    @Test
    void deleteThrowsForOwningApplicantWhenVerified() {
        LoanApplication app = new LoanApplication();
        Document doc = new Document();
        doc.setApplication(app);
        doc.setVerificationStatus("VERIFIED");
        User caller = user(5L, "ROLE_USER");

        when(service.getDocument(10L)).thenReturn(doc);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAdmin(caller)).thenReturn(false);
        when(accessGuard.isOwningApplicant(app, caller)).thenReturn(true);

        assertThatThrownBy(() -> controller.delete(10L)).isInstanceOf(ApiException.class);
        verify(service, never()).deleteDocument(anyLong());
    }

    @Test
    void deleteThrowsForOwningApplicantWhenRejected() {
        LoanApplication app = new LoanApplication();
        Document doc = new Document();
        doc.setApplication(app);
        doc.setVerificationStatus("REJECTED");
        User caller = user(5L, "ROLE_USER");

        when(service.getDocument(10L)).thenReturn(doc);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAdmin(caller)).thenReturn(false);
        when(accessGuard.isOwningApplicant(app, caller)).thenReturn(true);

        assertThatThrownBy(() -> controller.delete(10L)).isInstanceOf(ApiException.class);
        verify(service, never()).deleteDocument(anyLong());
    }

    @Test
    void deleteThrowsForNonOwnerNonAdmin() {
        LoanApplication app = new LoanApplication();
        Document doc = new Document();
        doc.setApplication(app);
        doc.setVerificationStatus("PENDING");
        User caller = user(6L, "ROLE_USER");

        when(service.getDocument(10L)).thenReturn(doc);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAdmin(caller)).thenReturn(false);
        when(accessGuard.isOwningApplicant(app, caller)).thenReturn(false);

        assertThatThrownBy(() -> controller.delete(10L)).isInstanceOf(ApiException.class);
        verify(service, never()).deleteDocument(anyLong());
    }

    // ---------- updateDocumentStatus ----------

    @Test
    void updateDocumentStatusThrowsWhenCallerIsNotAssignedProcessor() {
        LoanApplication app = new LoanApplication();
        Document existing = new Document();
        existing.setApplication(app);
        User caller = user(1L, "ROLE_PROCESSOR");
        Map<String, String> payload = new HashMap<>();
        payload.put("verificationStatus", "VERIFIED");

        when(service.getDocument(10L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAssignedProcessor(app, caller)).thenReturn(false);

        assertThatThrownBy(() -> controller.updateDocumentStatus(10L, payload)).isInstanceOf(ApiException.class);
    }

    @Test
    void updateDocumentStatusVerifiedLogsHistoryWithVerificationStatusKey() {
        LoanApplication app = new LoanApplication();
        Document existing = new Document();
        existing.setApplication(app);
        existing.setFileName("pan.pdf");
        existing.setDocumentType("PAN_CARD");
        User caller = user(1L, "ROLE_PROCESSOR");
        Map<String, String> payload = new HashMap<>();
        payload.put("verificationStatus", "VERIFIED");

        Document updated = new Document();
        updated.setApplication(app);
        updated.setFileName("pan.pdf");
        updated.setDocumentType("PAN_CARD");
        updated.setVerificationStatus("VERIFIED");

        when(service.getDocument(10L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAssignedProcessor(app, caller)).thenReturn(true);
        when(service.updateDocument(eq(10L), any(Document.class))).thenReturn(updated);

        ResponseEntity<Document> resp = controller.updateDocumentStatus(10L, payload);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(existing.getVerificationStatus()).isEqualTo("VERIFIED");
        verify(historyService).log(eq(app), eq(caller), eq("DOCUMENT_VERIFIED"), any(String.class));
    }

    @Test
    void updateDocumentStatusFallsBackToStatusKeyAndLogsRejected() {
        LoanApplication app = new LoanApplication();
        Document existing = new Document();
        existing.setApplication(app);
        existing.setFileName("pan.pdf");
        existing.setDocumentType("PAN_CARD");
        User caller = user(1L, "ROLE_PROCESSOR");
        Map<String, String> payload = new HashMap<>();
        payload.put("status", "rejected");

        Document updated = new Document();
        updated.setApplication(app);
        updated.setFileName("pan.pdf");
        updated.setDocumentType("PAN_CARD");
        updated.setVerificationStatus("REJECTED");

        when(service.getDocument(10L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAssignedProcessor(app, caller)).thenReturn(true);
        when(service.updateDocument(eq(10L), any(Document.class))).thenReturn(updated);

        ResponseEntity<Document> resp = controller.updateDocumentStatus(10L, payload);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(existing.getVerificationStatus()).isEqualTo("REJECTED");
        verify(historyService).log(eq(app), eq(caller), eq("DOCUMENT_REJECTED"), any(String.class));
    }

    @Test
    void updateDocumentStatusWithOnlyRemarksDoesNotLogHistory() {
        LoanApplication app = new LoanApplication();
        Document existing = new Document();
        existing.setApplication(app);
        existing.setVerificationStatus("PENDING");
        User caller = user(1L, "ROLE_PROCESSOR");
        Map<String, String> payload = new HashMap<>();
        payload.put("remarks", "please resend clearer scan");

        Document updated = new Document();
        updated.setApplication(app);
        updated.setVerificationStatus("PENDING");
        updated.setRemarks("please resend clearer scan");

        when(service.getDocument(10L)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAssignedProcessor(app, caller)).thenReturn(true);
        when(service.updateDocument(eq(10L), any(Document.class))).thenReturn(updated);

        ResponseEntity<Document> resp = controller.updateDocumentStatus(10L, payload);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(historyService, never()).log(any(), any(), any(), any());
    }

    // ---------- requestDocuments ----------

    @Test
    void requestDocumentsThrowsWhenCallerIsNotAssignedProcessor() {
        LoanApplication app = new LoanApplication();
        User caller = user(1L, "ROLE_PROCESSOR");

        when(loanApplicationService.getApplication(20L)).thenReturn(app);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAssignedProcessor(app, caller)).thenReturn(false);

        assertThatThrownBy(() -> controller.requestDocuments(20L, Map.of("message", "need pan card")))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void requestDocumentsHappyPathWithMessageSetsStatusAndLogsHistory() {
        LoanApplication app = new LoanApplication();
        User caller = user(1L, "ROLE_PROCESSOR");
        Map<String, String> payload = new HashMap<>();
        payload.put("message", "please upload address proof");

        LoanApplication updated = new LoanApplication();
        updated.setStatus("Waiting for Documents");

        when(loanApplicationService.getApplication(20L)).thenReturn(app);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAssignedProcessor(app, caller)).thenReturn(true);
        when(loanApplicationService.updateApplication(eq(20L), any(LoanApplication.class))).thenReturn(updated);

        ResponseEntity<LoanApplication> resp = controller.requestDocuments(20L, payload);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(app.getStatus()).isEqualTo("Waiting for Documents");
        assertThat(app.getDecisionComments()).isEqualTo("please upload address proof");
        verify(historyService).log(updated, caller, "DOCUMENTS_REQUESTED", "please upload address proof");
    }

    @Test
    void requestDocumentsHappyPathWithNullPayloadUsesGenericDetails() {
        LoanApplication app = new LoanApplication();
        User caller = user(1L, "ROLE_PROCESSOR");

        LoanApplication updated = new LoanApplication();
        updated.setStatus("Waiting for Documents");

        when(loanApplicationService.getApplication(20L)).thenReturn(app);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAssignedProcessor(app, caller)).thenReturn(true);
        when(loanApplicationService.updateApplication(eq(20L), any(LoanApplication.class))).thenReturn(updated);

        ResponseEntity<LoanApplication> resp = controller.requestDocuments(20L, null);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(app.getStatus()).isEqualTo("Waiting for Documents");
        verify(historyService).log(updated, caller, "DOCUMENTS_REQUESTED",
                "Processor requested additional/corrected documents.");
    }
}
