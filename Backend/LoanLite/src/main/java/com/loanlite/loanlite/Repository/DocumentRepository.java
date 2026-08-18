package com.loanlite.loanlite.Repository;

import com.loanlite.loanlite.entities.Document;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DocumentRepository extends JpaRepository<Document, Long> {
    List<Document> findByApplicationId(Long applicationId);
    List<Document> findByApplicationIdOrderByUploadedAtDesc(Long applicationId);
    List<Document> findByDocumentType(String documentType);
}
