package com.loanlite.loanlite.controllers;

import com.loanlite.loanlite.entities.ApplicationHistory;
import com.loanlite.loanlite.services.ApplicationHistoryService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/application-history")
public class ApplicationHistoryController {
    private final ApplicationHistoryService service;

    public ApplicationHistoryController(ApplicationHistoryService service) { this.service = service; }

    // POST /api/application-history
    // Records a new audit log entry for an application, for example a status change or a decision.
    @PostMapping
    public ResponseEntity<ApplicationHistory> create(@RequestBody ApplicationHistory h) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createHistory(h));
    }

    // GET /api/application-history/{id}
    // Fetches a single history entry by its id.
    @GetMapping("/{id}")
    public ResponseEntity<ApplicationHistory> get(@PathVariable Long id) {
        return ResponseEntity.ok(service.getHistory(id));
    }

    // GET /api/application-history
    // Returns every history entry across all applications.
    @GetMapping
    public ResponseEntity<List<ApplicationHistory>> list() {
        return ResponseEntity.ok(service.listHistory());
    }

    // PUT /api/application-history/{id}
    // Replaces the fields of an existing history entry, for example its action or details.
    @PutMapping("/{id}")
    public ResponseEntity<ApplicationHistory> update(@PathVariable Long id, @RequestBody ApplicationHistory h) {
        return ResponseEntity.ok(service.updateHistory(id, h));
    }

    // DELETE /api/application-history/{id}
    // Removes a history entry from the system.
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.deleteHistory(id);
        return ResponseEntity.noContent().build();
    }
}
