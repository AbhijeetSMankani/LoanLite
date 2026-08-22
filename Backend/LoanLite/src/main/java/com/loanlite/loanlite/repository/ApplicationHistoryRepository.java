package com.loanlite.loanlite.repository;

import com.loanlite.loanlite.DAO.ApplicationHistoryDAO;
import com.loanlite.loanlite.entities.ApplicationHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ApplicationHistoryRepository extends JpaRepository<ApplicationHistory, Long>, ApplicationHistoryDAO {
    List<ApplicationHistory> findByApplicationId(Long applicationId);
    List<ApplicationHistory> findByUserId(Long userId);
    List<ApplicationHistory> findByAction(String action);
    List<ApplicationHistory> findByApplicationIdOrderByCreatedAtDesc(Long applicationId);

    // Ownership filter moved into the query itself (featuresTodo.csv task 11) - same reasoning
    // as DocumentRepository.findVisibleTo(): the old ApplicationHistoryController.list() fetched
    // every row via findAll() and filtered with a Java stream, which doesn't compose with paging.
    @Query("SELECT h FROM ApplicationHistory h WHERE :isAdmin = true "
            + "OR h.application.applicant.id = :callerId "
            + "OR h.application.processor.id = :callerId "
            + "OR h.application.underwriter.id = :callerId")
    Page<ApplicationHistory> findVisibleTo(@Param("callerId") Long callerId, @Param("isAdmin") boolean isAdmin, Pageable pageable);
}
