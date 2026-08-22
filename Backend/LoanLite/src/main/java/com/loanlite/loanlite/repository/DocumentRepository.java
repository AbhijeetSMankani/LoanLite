package com.loanlite.loanlite.repository;

import com.loanlite.loanlite.DAO.DocumentDAO;
import com.loanlite.loanlite.entities.Document;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DocumentRepository extends JpaRepository<Document, Long>, DocumentDAO {
    List<Document> findByApplicationId(Long applicationId);

    List<Document> findByApplicationIdOrderByUploadedAtDesc(Long applicationId);

    List<Document> findByDocumentType(String documentType);

    // Ownership filter moved into the query itself (featuresTodo.csv task 11) - the old
    // DocumentController.list() fetched every row via findAll() and filtered down with a Java
    // stream, so pagination on top of that would have paged over an unbounded in-memory fetch
    // instead of the database doing the filtering and paging together. One query serves both
    // admin (isAdmin = true short-circuits the OR) and non-admin callers.
    @Query("SELECT d FROM Document d WHERE :isAdmin = true "
            + "OR d.application.applicant.id = :callerId "
            + "OR d.application.processor.id = :callerId "
            + "OR d.application.underwriter.id = :callerId")
    Page<Document> findVisibleTo(@Param("callerId") Long callerId, @Param("isAdmin") boolean isAdmin, Pageable pageable);
}
