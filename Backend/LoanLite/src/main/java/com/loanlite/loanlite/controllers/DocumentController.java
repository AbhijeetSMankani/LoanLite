package com.loanlite.loanlite.controllers;

import com.loanlite.loanlite.entities.Document;
import com.loanlite.loanlite.services.DocumentService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/documents")
public class DocumentController {
    private final DocumentService service;

    public DocumentController(DocumentService service) { this.service = service; }

    @PostMapping
    public ResponseEntity<Document> create(@RequestBody Document doc) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createDocument(doc));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Document> get(@PathVariable Long id) {
        return ResponseEntity.ok(service.getDocument(id));
    }

    @GetMapping
    public ResponseEntity<List<Document>> list() {
        return ResponseEntity.ok(service.listDocuments());
    }

    @PutMapping("/{id}")
    public ResponseEntity<Document> update(@PathVariable Long id, @RequestBody Document doc) {
        return ResponseEntity.ok(service.updateDocument(id, doc));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.deleteDocument(id);
        return ResponseEntity.noContent().build();
    }
}
