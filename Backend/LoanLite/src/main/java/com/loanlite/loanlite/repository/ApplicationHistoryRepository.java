package com.loanlite.loanlite.repository;

import com.loanlite.loanlite.DAO.ApplicationHistoryDAO;
import com.loanlite.loanlite.entities.ApplicationHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ApplicationHistoryRepository extends JpaRepository<ApplicationHistory, Long>, ApplicationHistoryDAO {
    List<ApplicationHistory> findByApplicationId(Long applicationId);
    List<ApplicationHistory> findByUserId(Long userId);
    List<ApplicationHistory> findByAction(String action);
    List<ApplicationHistory> findByApplicationIdOrderByCreatedAtDesc(Long applicationId);
}
