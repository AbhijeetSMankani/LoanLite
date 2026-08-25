package com.loanlite.loanlite.controllers;

import com.loanlite.loanlite.entities.User;
import com.loanlite.loanlite.exception.ApiException;
import com.loanlite.loanlite.services.UserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserControllerTest {

    @Mock
    private UserService service;

    @InjectMocks
    private UserController controller;

    private User user(Long id, String email, String role) {
        User u = new User();
        u.setId(id);
        u.setEmail(email);
        u.setRole(role);
        return u;
    }

    // ---------- create ----------

    @Test
    void createDelegatesToServiceAndReturns201() {
        User toCreate = new User();
        User created = user(1L, "new@example.com", "ROLE_USER");
        when(service.createUser(toCreate)).thenReturn(created);

        ResponseEntity<User> resp = controller.create(toCreate);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(resp.getBody()).isSameAs(created);
        verify(service).createUser(toCreate);
    }

    // ---------- get ----------

    @Test
    void getReturns200WhenCallerIsAdminViewingSomeoneElse() {
        User target = user(2L, "target@example.com", "ROLE_USER");
        when(service.getUser(2L)).thenReturn(target);

        try (MockedStatic<SecurityContextHolder> mockedStatic = mockStatic(SecurityContextHolder.class)) {
            SecurityContext securityContext = mock(SecurityContext.class);
            Authentication authentication = mock(Authentication.class);
            mockedStatic.when(SecurityContextHolder::getContext).thenReturn(securityContext);
            when(securityContext.getAuthentication()).thenReturn(authentication);
            when(authentication.getName()).thenReturn("admin@example.com");
            doReturn(List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))).when(authentication).getAuthorities();

            ResponseEntity<User> resp = controller.get(2L);

            assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(resp.getBody()).isSameAs(target);
        }
    }

    @Test
    void getReturns200WhenNonAdminViewingOwnAccount() {
        User target = user(3L, "self@example.com", "ROLE_USER");
        when(service.getUser(3L)).thenReturn(target);

        try (MockedStatic<SecurityContextHolder> mockedStatic = mockStatic(SecurityContextHolder.class)) {
            SecurityContext securityContext = mock(SecurityContext.class);
            Authentication authentication = mock(Authentication.class);
            mockedStatic.when(SecurityContextHolder::getContext).thenReturn(securityContext);
            when(securityContext.getAuthentication()).thenReturn(authentication);
            when(authentication.getName()).thenReturn("self@example.com");
            doReturn(List.of(new SimpleGrantedAuthority("ROLE_USER"))).when(authentication).getAuthorities();

            ResponseEntity<User> resp = controller.get(3L);

            assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(resp.getBody()).isSameAs(target);
        }
    }

    @Test
    void getThrowsApiExceptionWhenNonAdminEmailMismatch() {
        User target = user(4L, "target@example.com", "ROLE_USER");
        when(service.getUser(4L)).thenReturn(target);

        try (MockedStatic<SecurityContextHolder> mockedStatic = mockStatic(SecurityContextHolder.class)) {
            SecurityContext securityContext = mock(SecurityContext.class);
            Authentication authentication = mock(Authentication.class);
            mockedStatic.when(SecurityContextHolder::getContext).thenReturn(securityContext);
            when(securityContext.getAuthentication()).thenReturn(authentication);
            when(authentication.getName()).thenReturn("other@example.com");
            doReturn(List.of(new SimpleGrantedAuthority("ROLE_USER"))).when(authentication).getAuthorities();

            assertThatThrownBy(() -> controller.get(4L)).isInstanceOf(ApiException.class);
        }
    }

    // ---------- list ----------

    @Test
    void listDelegatesToService() {
        Pageable pageable = mock(Pageable.class);
        Page<User> page = new PageImpl<>(List.of());
        when(service.listUsers(pageable)).thenReturn(page);

        ResponseEntity<Page<User>> resp = controller.list(pageable);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isSameAs(page);
        verify(service).listUsers(pageable);
    }

    // ---------- update ----------

    @Test
    void updateThrowsApiExceptionWhenNotAdminAndNotOwner() {
        User existing = user(5L, "target@example.com", "ROLE_USER");
        User patch = new User();
        when(service.getUser(5L)).thenReturn(existing);

        try (MockedStatic<SecurityContextHolder> mockedStatic = mockStatic(SecurityContextHolder.class)) {
            SecurityContext securityContext = mock(SecurityContext.class);
            Authentication authentication = mock(Authentication.class);
            mockedStatic.when(SecurityContextHolder::getContext).thenReturn(securityContext);
            when(securityContext.getAuthentication()).thenReturn(authentication);
            when(authentication.getName()).thenReturn("other@example.com");
            doReturn(List.of(new SimpleGrantedAuthority("ROLE_USER"))).when(authentication).getAuthorities();

            assertThatThrownBy(() -> controller.update(5L, patch)).isInstanceOf(ApiException.class);
        }
    }

    @Test
    void updateThrowsIllegalArgumentExceptionWhenOwnerChangesOwnRole() {
        User existing = user(6L, "self@example.com", "ROLE_USER");
        User patch = new User();
        patch.setRole("ROLE_ADMIN");
        when(service.getUser(6L)).thenReturn(existing);

        try (MockedStatic<SecurityContextHolder> mockedStatic = mockStatic(SecurityContextHolder.class)) {
            SecurityContext securityContext = mock(SecurityContext.class);
            Authentication authentication = mock(Authentication.class);
            mockedStatic.when(SecurityContextHolder::getContext).thenReturn(securityContext);
            when(securityContext.getAuthentication()).thenReturn(authentication);
            when(authentication.getName()).thenReturn("self@example.com");
            doReturn(List.of(new SimpleGrantedAuthority("ROLE_USER"))).when(authentication).getAuthorities();

            assertThatThrownBy(() -> controller.update(6L, patch)).isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Test
    void updateAllowsOwnerWhenRoleIsNullOrUnchanged() {
        User existing = user(7L, "self@example.com", "ROLE_USER");
        User patch = new User();
        patch.setRole(null);
        User updated = user(7L, "self@example.com", "ROLE_USER");
        when(service.getUser(7L)).thenReturn(existing);
        when(service.updateUser(eq(7L), any(User.class))).thenReturn(updated);

        try (MockedStatic<SecurityContextHolder> mockedStatic = mockStatic(SecurityContextHolder.class)) {
            SecurityContext securityContext = mock(SecurityContext.class);
            Authentication authentication = mock(Authentication.class);
            mockedStatic.when(SecurityContextHolder::getContext).thenReturn(securityContext);
            when(securityContext.getAuthentication()).thenReturn(authentication);
            when(authentication.getName()).thenReturn("self@example.com");
            doReturn(List.of(new SimpleGrantedAuthority("ROLE_USER"))).when(authentication).getAuthorities();

            ResponseEntity<User> resp = controller.update(7L, patch);

            assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
            verify(service).updateUser(eq(7L), any(User.class));
        }
    }

    @Test
    void updateAllowsAdminUpdatingSomeoneElseRegardlessOfRoleField() {
        User existing = user(8L, "target@example.com", "ROLE_USER");
        User patch = new User();
        patch.setRole("ROLE_PROCESSOR");
        User updated = user(8L, "target@example.com", "ROLE_PROCESSOR");
        when(service.getUser(8L)).thenReturn(existing);
        when(service.updateUser(eq(8L), any(User.class))).thenReturn(updated);

        try (MockedStatic<SecurityContextHolder> mockedStatic = mockStatic(SecurityContextHolder.class)) {
            SecurityContext securityContext = mock(SecurityContext.class);
            Authentication authentication = mock(Authentication.class);
            mockedStatic.when(SecurityContextHolder::getContext).thenReturn(securityContext);
            when(securityContext.getAuthentication()).thenReturn(authentication);
            when(authentication.getName()).thenReturn("admin@example.com");
            doReturn(List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))).when(authentication).getAuthorities();

            ResponseEntity<User> resp = controller.update(8L, patch);

            assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(resp.getBody()).isSameAs(updated);
        }
    }

    // ---------- delete ----------

    @Test
    void deleteDelegatesToServiceAndReturns204() {
        ResponseEntity<Void> resp = controller.delete(9L);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(service).deleteUser(9L);
    }
}
