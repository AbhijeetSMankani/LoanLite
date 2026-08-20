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

    // POST /api/documents
    // Creates a document record directly from a JSON body (metadata only, no file upload).
    // For uploading an actual file, use POST /api/applications/{id}/documents instead.
    @PostMapping
    public ResponseEntity<Document> create(@RequestBody Document doc) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createDocument(doc));
    }

    // GET /api/documents/{id}
    // Fetches a single document record by its id.
    @GetMapping("/{id}")
    public ResponseEntity<Document> get(@PathVariable Long id) {
        return ResponseEntity.ok(service.getDocument(id));
    }

    // GET /api/documents
    // Returns every document record in the system.
    @GetMapping
    public ResponseEntity<List<Document>> list() {
        return ResponseEntity.ok(service.listDocuments());
    }

    // PUT /api/documents/{id}
    // Replaces a document's fields, for example its verification status or remarks.
    @PutMapping("/{id}")
    public ResponseEntity<Document> update(@PathVariable Long id, @RequestBody Document doc) {
        return ResponseEntity.ok(service.updateDocument(id, doc));
    }

    // DELETE /api/documents/{id}
    // Removes a document record from the system.
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.deleteDocument(id);
        return ResponseEntity.noContent().build();
    }
}
