package com.loanlite.loanlite.controllers;

import com.loanlite.loanlite.entities.User;
import com.loanlite.loanlite.security.LoanApplicationAccessGuard;
import com.loanlite.loanlite.services.LoanApplicationService;
import com.loanlite.loanlite.services.UserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminControllerTest {

    @Mock
    private UserService userService;

    @Mock
    private LoanApplicationAccessGuard accessGuard;

    @Mock
    private LoanApplicationService loanApplicationService;

    @InjectMocks
    private AdminController controller;

    private User user(Long id, String role) {
        User u = new User();
        u.setId(id);
        u.setRole(role);
        return u;
    }

    @Test
    void assignRoleThrowsWhenRoleKeyMissing() {
        assertThatThrownBy(() -> controller.assignRole(1L, new HashMap<>()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void assignRoleThrowsWhenRoleKeyBlank() {
        Map<String, String> payload = new HashMap<>();
        payload.put("role", "  ");

        assertThatThrownBy(() -> controller.assignRole(1L, payload))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void assignRoleThrowsForUnknownRole() {
        Map<String, String> payload = new HashMap<>();
        payload.put("role", "ROLE_HACKER");

        assertThatThrownBy(() -> controller.assignRole(1L, payload))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void assignRoleThrowsWhenAdminTriesToChangeOwnRole() {
        Long id = 1L;
        User existing = user(id, "ROLE_ADMIN");
        User caller = user(id, "ROLE_ADMIN");
        Map<String, String> payload = new HashMap<>();
        payload.put("role", "ROLE_USER");

        when(userService.getUser(id)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);

        assertThatThrownBy(() -> controller.assignRole(id, payload))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void assignRoleAllowsAdminResubmittingOwnCurrentRoleUnchanged() {
        Long id = 1L;
        User existing = user(id, "ROLE_ADMIN");
        User caller = user(id, "ROLE_ADMIN");
        Map<String, String> payload = new HashMap<>();
        payload.put("role", "ROLE_ADMIN");
        User updated = user(id, "ROLE_ADMIN");

        when(userService.getUser(id)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(userService.updateUser(eq(id), any(User.class))).thenReturn(updated);

        ResponseEntity<User> resp = controller.assignRole(id, payload);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(userService).updateUser(eq(id), any(User.class));
    }

    @Test
    void assignRoleHappyPathChangingAnotherUsersRole() {
        Long targetId = 2L;
        User existing = user(targetId, "ROLE_USER");
        User caller = user(1L, "ROLE_ADMIN");
        Map<String, String> payload = new HashMap<>();
        payload.put("role", "ROLE_PROCESSOR");
        User updated = user(targetId, "ROLE_PROCESSOR");

        when(userService.getUser(targetId)).thenReturn(existing);
        when(accessGuard.currentUser()).thenReturn(caller);
        when(userService.updateUser(eq(targetId), any(User.class))).thenReturn(updated);

        ResponseEntity<User> resp = controller.assignRole(targetId, payload);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isSameAs(updated);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userService).updateUser(eq(targetId), captor.capture());
        assertThat(captor.getValue().getRole()).isEqualTo("ROLE_PROCESSOR");
    }

    @Test
    void getStatsDelegatesToLoanApplicationService() {
        Map<String, Object> stats = Map.of("totalApplications", 5L);
        when(loanApplicationService.getStats()).thenReturn(stats);

        ResponseEntity<Map<String, Object>> resp = controller.getStats();

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isSameAs(stats);
        verify(loanApplicationService).getStats();
    }
}
