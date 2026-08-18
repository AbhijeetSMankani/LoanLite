package com.loanlite.loanlite.Repository;

import com.loanlite.loanlite.entities.ApplicationHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ApplicationHistoryRepository extends JpaRepository<ApplicationHistory, Long> {
    List<ApplicationHistory> findByApplicationId(Long applicationId);
    List<ApplicationHistory> findByUserId(Long userId);
    List<ApplicationHistory> findByAction(String action);
    List<ApplicationHistory> findByApplicationIdOrderByCreatedAtDesc(Long applicationId);
}
