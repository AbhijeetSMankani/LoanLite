package com.loanlite.loanlite.DAO;

import com.loanlite.loanlite.Entities.Document;

import java.util.List;

public interface DocumentDAO {

    List<Document> findByApplicationId(Long applicationId);

    List<Document> findByApplicationIdOrderByUploadedAtDesc(Long applicationId);

    List<Document> findByDocumentType(String documentType);
}
