package com.loanlite.loanlite.controllers;

import com.loanlite.loanlite.entities.ApplicationHistory;
import com.loanlite.loanlite.entities.LoanApplication;
import com.loanlite.loanlite.entities.User;
import com.loanlite.loanlite.exception.ApiException;
import com.loanlite.loanlite.security.LoanApplicationAccessGuard;
import com.loanlite.loanlite.services.ApplicationHistoryService;
import org.junit.jupiter.api.BeforeEach;
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
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ApplicationHistoryControllerTest {

    @Mock
    private ApplicationHistoryService service;

    @Mock
    private LoanApplicationAccessGuard accessGuard;

    @InjectMocks
    private ApplicationHistoryController controller;

    @BeforeEach
    void wireFieldInjectedAccessGuard() {
        // ApplicationHistoryController takes `service` via its constructor but `accessGuard`
        // via field (@Autowired) injection. @InjectMocks only performs constructor injection
        // when an eligible constructor exists, so the field-injected collaborator is wired
        // manually here.
        ReflectionTestUtils.setField(controller, "accessGuard", accessGuard);
    }

    private User user(Long id, String role) {
        User u = new User();
        u.setId(id);
        u.setRole(role);
        return u;
    }

    // ---------- create ----------

    @Test
    void createDelegatesToServiceAndReturns201() {
        ApplicationHistory h = new ApplicationHistory();
        ApplicationHistory saved = new ApplicationHistory();
        saved.setId(1L);
        when(service.createHistory(h)).thenReturn(saved);

        ResponseEntity<ApplicationHistory> resp = controller.create(h);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(resp.getBody()).isSameAs(saved);
        verify(service).createHistory(h);
    }

    // ---------- get ----------

    @Test
    void getThrowsApiExceptionWhenCallerHasNoAccess() {
        LoanApplication app = new LoanApplication();
        ApplicationHistory entry = new ApplicationHistory();
        entry.setApplication(app);
        User caller = user(1L, "ROLE_USER");

        when(service.getHistory(5L)).thenReturn(entry);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.hasAccess(app, caller)).thenReturn(false);

        assertThatThrownBy(() -> controller.get(5L)).isInstanceOf(ApiException.class);
    }

    @Test
    void getReturns200WhenCallerHasAccess() {
        LoanApplication app = new LoanApplication();
        ApplicationHistory entry = new ApplicationHistory();
        entry.setApplication(app);
        User caller = user(1L, "ROLE_USER");

        when(service.getHistory(5L)).thenReturn(entry);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.hasAccess(app, caller)).thenReturn(true);

        ResponseEntity<ApplicationHistory> resp = controller.get(5L);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isSameAs(entry);
    }

    // ---------- list ----------

    @Test
    void listDelegatesToServiceWithCallerIdAndAdminFlag() {
        User caller = user(7L, "ROLE_USER");
        Pageable pageable = mock(Pageable.class);
        Page<ApplicationHistory> page = new PageImpl<>(List.of());

        when(accessGuard.currentUser()).thenReturn(caller);
        when(accessGuard.isAdmin(caller)).thenReturn(false);
        when(service.listVisibleTo(7L, false, pageable)).thenReturn(page);

        ResponseEntity<Page<ApplicationHistory>> resp = controller.list(pageable);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isSameAs(page);
        verify(service).listVisibleTo(7L, false, pageable);
    }

    // ---------- update ----------

    @Test
    void updateDelegatesToServiceAndReturns200() {
        ApplicationHistory h = new ApplicationHistory();
        ApplicationHistory updated = new ApplicationHistory();
        when(service.updateHistory(10L, h)).thenReturn(updated);

        ResponseEntity<ApplicationHistory> resp = controller.update(10L, h);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isSameAs(updated);
        verify(service).updateHistory(10L, h);
    }

    // ---------- delete ----------

    @Test
    void deleteDelegatesToServiceAndReturns204() {
        ResponseEntity<Void> resp = controller.delete(10L);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(service).deleteHistory(10L);
    }
}
