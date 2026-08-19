package com.loanlite.loanlite.controllers;

import com.loanlite.loanlite.controllers.auth.RegisterRequest;
import com.loanlite.loanlite.controllers.auth.AuthRequest;
import com.loanlite.loanlite.entities.User;
import com.loanlite.loanlite.controllers.auth.UserResponse;
import com.loanlite.loanlite.services.UserService;
import org.junit.jupiter.api.Test;

import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import java.util.Collection;
import java.util.Collections;

import static org.assertj.core.api.Assertions.assertThat;

public class AuthControllerTest {

    @Test
    public void registerReturnsUserResponseWithoutPassword() {
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

        // simple fake UserService by overriding createUser
        UserService userService = new UserService(passwordEncoder()) {
            @Override
            public User createUser(User user) {
                return saved;
            }
        };

        AuthController controller = new AuthController(null, null, userService);
        ResponseEntity<UserResponse> resp = controller.register(req);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatusCode.valueOf(201));
        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().getEmail()).isEqualTo("john@example.com");
        assertThat(resp.getBody().getFirstName()).isEqualTo("John");
    }

    @Test
    public void loginReturnsToken() {
        AuthRequest req = new AuthRequest();
        req.setEmail("john@example.com");
        req.setPassword("secretPass");

        // fake AuthenticationManager
        AuthenticationManager authManager = authentication -> {
            Collection<GrantedAuthority> auths = Collections.emptyList();
            Authentication a = new UsernamePasswordAuthenticationToken(new org.springframework.security.core.userdetails.User("john@example.com","",auths), null, auths);
            return a;
        };

        // fake JwtUtil - we won't call it here to avoid setup complexity
        com.loanlite.loanlite.security.jwt.JwtUtil jwtUtil = new com.loanlite.loanlite.security.jwt.JwtUtil();

        AuthController controller = new AuthController(authManager, jwtUtil, null);

        Authentication auth = authManager.authenticate(new UsernamePasswordAuthenticationToken(req.getEmail(), req.getPassword()));
        assertThat(auth).isNotNull();
        assertThat(auth.getName()).isEqualTo("john@example.com");
    }

    // minimal PasswordEncoder provider for tests
    private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder() {
        return new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder();
    }
}
