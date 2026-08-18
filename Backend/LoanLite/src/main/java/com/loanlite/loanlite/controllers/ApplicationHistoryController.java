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

    @PostMapping
    public ResponseEntity<ApplicationHistory> create(@RequestBody ApplicationHistory h) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createHistory(h));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApplicationHistory> get(@PathVariable Long id) {
        return ResponseEntity.ok(service.getHistory(id));
    }

    @GetMapping
    public ResponseEntity<List<ApplicationHistory>> list() {
        return ResponseEntity.ok(service.listHistory());
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApplicationHistory> update(@PathVariable Long id, @RequestBody ApplicationHistory h) {
        return ResponseEntity.ok(service.updateHistory(id, h));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.deleteHistory(id);
        return ResponseEntity.noContent().build();
    }
}
