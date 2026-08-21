package com.loanlite.loanlite.controllers;

import com.loanlite.loanlite.entities.ApplicationHistory;
import com.loanlite.loanlite.entities.User;
import com.loanlite.loanlite.security.LoanApplicationAccessGuard;
import com.loanlite.loanlite.services.ApplicationHistoryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/application-history")
public class ApplicationHistoryController {
    private final ApplicationHistoryService service;

    @Autowired
    private LoanApplicationAccessGuard accessGuard;

    public ApplicationHistoryController(ApplicationHistoryService service) { this.service = service; }

    // POST /api/application-history
    // Records a new audit log entry for an application, for example a status change or a decision.
    // ADMIN only: no user should be writing history entries manually - this is a stand-in until
    // task 12 automates history writes from the actions themselves (submit, verify, claim, etc).
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApplicationHistory> create(@RequestBody ApplicationHistory h) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createHistory(h));
    }

    // GET /api/application-history/{id}
    // Fetches a single history entry by its id. Ownership-checked via the entry's application:
    // owning applicant, assigned processor/underwriter, or admin only.
    @GetMapping("/{id}")
    public ResponseEntity<ApplicationHistory> get(@PathVariable Long id) {
        ApplicationHistory entry = service.getHistory(id);
        if (!accessGuard.hasAccess(entry.getApplication(), accessGuard.currentUser())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(entry);
    }

    // GET /api/application-history
    // Returns every history entry the caller has access to: an applicant's own application's
    // history, a processor/underwriter's assigned/claimed application's history, or everything
    // for admin.
    @GetMapping
    public ResponseEntity<List<ApplicationHistory>> list() {
        User caller = accessGuard.currentUser();
        List<ApplicationHistory> visible = service.listHistory().stream()
                .filter(entry -> accessGuard.hasAccess(entry.getApplication(), caller))
                .collect(Collectors.toList());
        return ResponseEntity.ok(visible);
    }

    // PUT /api/application-history/{id}
    // Replaces the fields of an existing history entry, for example its action or details.
    // ADMIN only, same reasoning as create().
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApplicationHistory> update(@PathVariable Long id, @RequestBody ApplicationHistory h) {
        return ResponseEntity.ok(service.updateHistory(id, h));
    }

    // DELETE /api/application-history/{id}
    // Removes a history entry from the system. ADMIN only - an audit trail that any user could
    // delete from isn't an audit trail.
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.deleteHistory(id);
        return ResponseEntity.noContent().build();
    }
}
