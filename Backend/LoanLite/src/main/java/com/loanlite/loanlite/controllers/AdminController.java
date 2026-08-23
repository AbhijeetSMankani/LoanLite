package com.loanlite.loanlite.controllers;

import java.util.Map;
import java.util.Set;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.loanlite.loanlite.entities.User;
import com.loanlite.loanlite.security.LoanApplicationAccessGuard;
import com.loanlite.loanlite.services.LoanApplicationService;
import com.loanlite.loanlite.services.UserService;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    @Autowired
    private UserService userService;

    @Autowired
    private LoanApplicationAccessGuard accessGuard;

    @Autowired
    private LoanApplicationService loanApplicationService;

    private static final Set<String> VALID_ROLES = Set.of(
            "ROLE_USER", "ROLE_PROCESSOR", "ROLE_UNDERWRITER", "ROLE_ADMIN"
    );

    // PATCH /api/admin/users/{id}/role
    // Dedicated, minimal role-assignment action - ADMIN only, touches only the role field
    // (unlike the generic PUT /api/users/{id}, which accepts and persists the whole entity).
    // An admin cannot use this to change their own role either, same guard as UserController.update().
    @PatchMapping("/users/{id}/role")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<User> assignRole(@PathVariable Long id, @RequestBody Map<String, String> payload) {
        String role = payload.get("role");
        if (role == null || role.isBlank()) {
            throw new IllegalArgumentException("role is required");
        }
        if (!VALID_ROLES.contains(role)) {
            throw new IllegalArgumentException("Unknown role: " + role);
        }

        User existing = userService.getUser(id);
        User caller = accessGuard.currentUser();
        if (caller.getId().equals(id) && !role.equals(existing.getRole())) {
            throw new IllegalArgumentException("You cannot change your own role");
        }

        User patch = new User();
        patch.setRole(role);
        return ResponseEntity.ok(userService.updateUser(id, patch));
    }

    // GET /api/admin/stats
    // Simple counts/analytics for the admin dashboard (backendTodo.csv task 6) - total
    // applications broken down by status, applications created this month, and applications
    // approved/rejected this month (the charter's own example: "how many loans were approved
    // this month"). All backed by COUNT/GROUP BY queries, not fetch-and-count in Java.
    @GetMapping("/stats")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getStats() {
        return ResponseEntity.ok(loanApplicationService.getStats());
    }
}
