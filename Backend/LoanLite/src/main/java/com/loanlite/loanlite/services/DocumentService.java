package com.loanlite.loanlite.services;

import com.loanlite.loanlite.DAO.DocumentDAO;
import com.loanlite.loanlite.repository.DocumentRepository;
import com.loanlite.loanlite.entities.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class DocumentService {

    @Autowired
    private DocumentRepository documentRepository;

    public Document createDocument(Document d) {
        if (d.getUploadedAt() == null) {
            d.setUploadedAt(LocalDateTime.now());
        }
        return documentRepository.save(d);
    }

    public Document getDocument(Long id) {
        return documentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Document not found with id: " + id));
    }

    public List<Document> listDocuments() {
        return documentRepository.findAll();
    }

    public List<Document> findByApplicationId(Long applicationId) {
        return documentRepository.findByApplicationId(applicationId);
    }

    public List<Document> findByApplicationIdOrderByUploadedAtDesc(Long applicationId) {
        return documentRepository.findByApplicationIdOrderByUploadedAtDesc(applicationId);
    }

    public List<Document> findByDocumentType(String documentType) {
        return documentRepository.findByDocumentType(documentType);
    }

    @Transactional
    public Document updateDocument(Long id, Document d) {
        Document existing = getDocument(id);

        if (d.getApplication() != null)
            existing.setApplication(d.getApplication());
        if (d.getDocumentType() != null)
            existing.setDocumentType(d.getDocumentType());
        if (d.getFileName() != null)
            existing.setFileName(d.getFileName());
        if (d.getFilePath() != null)
            existing.setFilePath(d.getFilePath());
        if (d.getVerificationStatus() != null)
            existing.setVerificationStatus(d.getVerificationStatus());
        if (d.getRemarks() != null)
            existing.setRemarks(d.getRemarks());
        if (d.getUploadedAt() != null)
            existing.setUploadedAt(d.getUploadedAt());

        return documentRepository.save(existing);
    }

    public void deleteDocument(Long id) {
        if (!documentRepository.existsById(id)) {
            throw new RuntimeException("Document not found with id: " + id);
        }
        documentRepository.deleteById(id);
    }
}
