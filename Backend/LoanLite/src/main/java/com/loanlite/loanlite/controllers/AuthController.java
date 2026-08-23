package com.loanlite.loanlite.controllers;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.loanlite.loanlite.controllers.auth.AuthRequest;
import com.loanlite.loanlite.controllers.auth.AuthResponse;
import com.loanlite.loanlite.controllers.auth.ChangePasswordRequest;
import com.loanlite.loanlite.controllers.auth.RegisterRequest;
import com.loanlite.loanlite.controllers.auth.UserResponse;
import com.loanlite.loanlite.entities.User;
import com.loanlite.loanlite.security.jwt.JwtUtil;
import com.loanlite.loanlite.services.UserService;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;
    private final UserService userService;

    public AuthController(AuthenticationManager authenticationManager, JwtUtil jwtUtil, UserService userService) {
        this.authenticationManager = authenticationManager;
        this.jwtUtil = jwtUtil;
        this.userService = userService;
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody AuthRequest req) {
        Authentication auth = authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(req.getEmail(), req.getPassword()));
        UserDetails ud = (UserDetails) auth.getPrincipal();
        String token = jwtUtil.generateToken(ud);
        return ResponseEntity.ok(new AuthResponse("Bearer", token));
    }

    @PostMapping("/register")
    public ResponseEntity<UserResponse> register(@RequestBody RegisterRequest req) {
        User u = new User();
        u.setEmail(req.getEmail());
        u.setPasswordHash(req.getPassword());
        u.setFirstName(req.getFirstName());
        u.setLastName(req.getLastName());
        User created = userService.createUser(u);
        UserResponse resp = new UserResponse(created.getId(), created.getEmail(), created.getFirstName(), created.getLastName(), created.getRole());
        return ResponseEntity.status(HttpStatus.CREATED).body(resp);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        return ResponseEntity.ok().build(); // Only Delete the token on the client side.
    }

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<UserResponse> me(Authentication authentication) {
        User user = userService.findByEmail(authentication.getName())
                .orElseThrow(() -> new IllegalStateException("Authenticated user not found: " + authentication.getName()));
        UserResponse resp = new UserResponse(user.getId(), user.getEmail(), user.getFirstName(), user.getLastName(), user.getRole());
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/change-password")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> changePassword(Authentication authentication, @RequestBody ChangePasswordRequest req) {
        User user = userService.findByEmail(authentication.getName())
                .orElseThrow(() -> new IllegalStateException("Authenticated user not found: " + authentication.getName()));
        // Lets IllegalArgumentException (wrong current password / blank new password) propagate
        // to GlobalExceptionHandler's existing handler instead of swallowing it into an
        // empty-body 400 (backendTodo.csv task 3) - the message is client-facing either way.
        userService.changePassword(user.getId(), req.getCurrentPassword(), req.getNewPassword());
        return ResponseEntity.ok().build();
    }
}

