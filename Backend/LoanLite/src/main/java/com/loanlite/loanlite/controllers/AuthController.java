package com.loanlite.loanlite.controllers;

import com.loanlite.loanlite.controllers.auth.AuthRequest;
import com.loanlite.loanlite.controllers.auth.AuthResponse;
import com.loanlite.loanlite.controllers.auth.RegisterRequest;
import com.loanlite.loanlite.controllers.auth.UserResponse;
import com.loanlite.loanlite.entities.User;
import com.loanlite.loanlite.security.jwt.JwtUtil;
import com.loanlite.loanlite.services.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

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
}

