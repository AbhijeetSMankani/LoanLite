package com.loanlite.loanlite.controllers;

import com.loanlite.loanlite.controllers.auth.AuthRequest;
import com.loanlite.loanlite.controllers.auth.AuthResponse;
import com.loanlite.loanlite.controllers.auth.ChangePasswordRequest;
import com.loanlite.loanlite.controllers.auth.RegisterRequest;
import com.loanlite.loanlite.controllers.auth.UserResponse;
import com.loanlite.loanlite.entities.User;
import com.loanlite.loanlite.security.jwt.JwtUtil;
import com.loanlite.loanlite.services.UserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.InjectMocks;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private JwtUtil jwtUtil;

    @Mock
    private UserService userService;

    @InjectMocks
    private AuthController controller;

    // ---------- login ----------

    @Test
    void loginReturnsBearerTokenOnSuccessfulAuthentication() {
        AuthRequest req = new AuthRequest();
        req.setEmail("john@example.com");
        req.setPassword("secretPass");

        org.springframework.security.core.userdetails.UserDetails principal =
                org.springframework.security.core.userdetails.User
                        .withUsername("john@example.com")
                        .password("")
                        .authorities("ROLE_USER")
                        .build();

        Authentication auth = mock(Authentication.class);
        when(auth.getPrincipal()).thenReturn(principal);
        when(authenticationManager.authenticate(any())).thenReturn(auth);
        when(jwtUtil.generateToken(any())).thenReturn("fake-jwt-token");

        ResponseEntity<AuthResponse> resp = controller.login(req);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().getTokenType()).isEqualTo("Bearer");
        assertThat(resp.getBody().getToken()).isEqualTo("fake-jwt-token");
    }

    // ---------- register ----------

    @Test
    void registerReturnsCreatedUserResponse() {
        RegisterRequest req = new RegisterRequest();
        req.setEmail("john@example.com");
        req.setPassword("secretPass");
        req.setFirstName("John");
        req.setLastName("Doe");

        User saved = new User();
        saved.setId(42L);
        saved.setEmail("john@example.com");
        saved.setFirstName("John");
        saved.setLastName("Doe");
        saved.setRole("ROLE_USER");

        when(userService.createUser(any(User.class))).thenReturn(saved);

        ResponseEntity<UserResponse> resp = controller.register(req);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        UserResponse body = resp.getBody();
        assertThat(body).isNotNull();
        assertThat(body.getId()).isEqualTo(42L);
        assertThat(body.getEmail()).isEqualTo("john@example.com");
        assertThat(body.getFirstName()).isEqualTo("John");
        assertThat(body.getLastName()).isEqualTo("Doe");
        assertThat(body.getRole()).isEqualTo("ROLE_USER");
    }

    // ---------- logout ----------

    @Test
    void logoutReturns200WithNoBody() {
        ResponseEntity<Void> resp = controller.logout();

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody()).isNull();
    }

    // ---------- me ----------

    @Test
    void meReturnsUserResponseWhenUserFound() {
        User found = new User();
        found.setId(7L);
        found.setEmail("someone@example.com");
        found.setFirstName("Some");
        found.setLastName("One");
        found.setRole("ROLE_USER");

        when(userService.findByEmail("someone@example.com")).thenReturn(Optional.of(found));

        Authentication authentication = new UsernamePasswordAuthenticationToken("someone@example.com", null);
        ResponseEntity<UserResponse> resp = controller.me(authentication);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        UserResponse body = resp.getBody();
        assertThat(body).isNotNull();
        assertThat(body.getId()).isEqualTo(7L);
        assertThat(body.getEmail()).isEqualTo("someone@example.com");
    }

    @Test
    void meThrowsIllegalStateExceptionWhenUserNotFound() {
        when(userService.findByEmail("someone@example.com")).thenReturn(Optional.empty());

        Authentication authentication = new UsernamePasswordAuthenticationToken("someone@example.com", null);

        assertThatThrownBy(() -> controller.me(authentication)).isInstanceOf(IllegalStateException.class);
    }

    // ---------- changePassword ----------

    @Test
    void changePasswordHappyPathDelegatesToUserService() {
        User found = new User();
        found.setId(9L);
        found.setEmail("someone@example.com");

        when(userService.findByEmail("someone@example.com")).thenReturn(Optional.of(found));

        Authentication authentication = new UsernamePasswordAuthenticationToken("someone@example.com", null);
        ChangePasswordRequest req = new ChangePasswordRequest();
        req.setCurrentPassword("oldPass");
        req.setNewPassword("newPass123");

        ResponseEntity<Void> resp = controller.changePassword(authentication, req);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(userService).changePassword(9L, "oldPass", "newPass123");
    }

    @Test
    void changePasswordThrowsIllegalStateExceptionWhenUserNotFound() {
        when(userService.findByEmail("someone@example.com")).thenReturn(Optional.empty());

        Authentication authentication = new UsernamePasswordAuthenticationToken("someone@example.com", null);
        ChangePasswordRequest req = new ChangePasswordRequest();
        req.setCurrentPassword("oldPass");
        req.setNewPassword("newPass123");

        assertThatThrownBy(() -> controller.changePassword(authentication, req))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void changePasswordPropagatesIllegalArgumentExceptionFromUserService() {
        User found = new User();
        found.setId(9L);
        found.setEmail("someone@example.com");

        when(userService.findByEmail("someone@example.com")).thenReturn(Optional.of(found));
        org.mockito.Mockito.doThrow(new IllegalArgumentException("current password is incorrect"))
                .when(userService).changePassword(eq(9L), any(), any());

        Authentication authentication = new UsernamePasswordAuthenticationToken("someone@example.com", null);
        ChangePasswordRequest req = new ChangePasswordRequest();
        req.setCurrentPassword("wrongPass");
        req.setNewPassword("newPass123");

        assertThatThrownBy(() -> controller.changePassword(authentication, req))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
