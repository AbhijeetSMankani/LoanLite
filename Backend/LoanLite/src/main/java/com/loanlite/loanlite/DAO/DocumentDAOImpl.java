package com.loanlite.loanlite.DAO;

import com.loanlite.loanlite.entities.Document;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class DocumentDAOImpl implements DocumentDAO {

        @PersistenceContext
        private EntityManager entityManager;

        @Override
        public List<Document> findByApplicationId(Long applicationId) {
                return entityManager
                                .createQuery(
                                                "SELECT d FROM Document d WHERE d.application.id = :applicationId",
                                                Document.class)
                                .setParameter("applicationId", applicationId)
                                .getResultList();
        }

        @Override
        public List<Document> findByApplicationIdOrderByUploadedAtDesc(Long applicationId) {
                return entityManager
                                .createQuery(
                                                "SELECT d FROM Document d WHERE d.application.id = :applicationId ORDER BY d.uploadedAt DESC",
                                                Document.class)
                                .setParameter("applicationId", applicationId)
                                .getResultList();
        }

        @Override
        public List<Document> findByDocumentType(String documentType) {
                return entityManager
                                .createQuery("SELECT d FROM Document d WHERE d.documentType = :documentType",
                                                Document.class)
                                .setParameter("documentType", documentType)
                                .getResultList();
        }
}
