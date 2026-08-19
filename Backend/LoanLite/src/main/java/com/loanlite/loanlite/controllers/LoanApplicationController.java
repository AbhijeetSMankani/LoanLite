package com.loanlite.loanlite.controllers;

import com.loanlite.loanlite.Services.LoanApplicationService;
import com.loanlite.loanlite.Entities.LoanApplication;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/loan-applications")
public class LoanApplicationController {
    @Autowired
    private LoanApplicationService service;


    @PostMapping
    public ResponseEntity<LoanApplication> create(@RequestBody LoanApplication app) {
        LoanApplication created = service.createApplication(app);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping("/{id}")
    public ResponseEntity<LoanApplication> get(@PathVariable Long id) {
        return ResponseEntity.ok(service.getApplication(id));
    }

    @GetMapping
    public ResponseEntity<List<LoanApplication>> list() {
        return ResponseEntity.ok(service.listApplications());
    }

    @PutMapping("/{id}")
    public ResponseEntity<LoanApplication> update(@PathVariable Long id, @RequestBody LoanApplication app) {
        return ResponseEntity.ok(service.updateApplication(id, app));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.deleteApplication(id);
        return ResponseEntity.noContent().build();
    }
}
