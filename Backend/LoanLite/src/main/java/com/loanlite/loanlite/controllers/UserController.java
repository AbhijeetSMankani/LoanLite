package com.loanlite.loanlite.controllers;

import com.loanlite.loanlite.entities.User;
import com.loanlite.loanlite.exception.ApiException;
import com.loanlite.loanlite.services.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/users")
public class UserController {
	@Autowired
    private UserService service;


    // @Valid enforces User's email/firstName/lastName constraints (backendTodo.csv task 7) -
    // safe here since create() always expects a full new user, unlike update()'s partial-merge
    // semantics below, which is deliberately left unvalidated for the same reason as
    // LoanApplicationController.update().
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<User> create(@Valid @RequestBody User user) {
        User created = service.createUser(user);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<User> get(@PathVariable Long id) {
        User u = service.getUser(id);
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean isAdmin = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        String current = auth.getName();
        if (!isAdmin && !current.equals(u.getEmail())) {
            throw ApiException.forbidden("You may only view your own account.");
        }
        return ResponseEntity.ok(u);
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Page<User>> list(@PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(service.listUsers(pageable));
    }

    @PutMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<User> update(@PathVariable Long id, @RequestBody User user) {
        // allow admin or owner to update
        User existing = service.getUser(id);
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean isAdmin = auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        String current = auth.getName();
        if (!isAdmin && !current.equals(existing.getEmail())) {
            throw ApiException.forbidden("You may only update your own account.");
        }
        if (current.equals(existing.getEmail()) && user.getRole() != null && !user.getRole().equals(existing.getRole())) {
            throw new IllegalArgumentException("You cannot change your own role");
        }
        return ResponseEntity.ok(service.updateUser(id, user));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.deleteUser(id);
        return ResponseEntity.noContent().build();
    }
}
