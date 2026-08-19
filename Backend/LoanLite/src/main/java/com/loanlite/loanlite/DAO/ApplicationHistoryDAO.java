package com.loanlite.loanlite.DAO;

import com.loanlite.loanlite.Entities.ApplicationHistory;

import java.util.List;

public interface ApplicationHistoryDAO {

    List<ApplicationHistory> findByApplicationId(Long applicationId);

    List<ApplicationHistory> findByUserId(Long userId);

    List<ApplicationHistory> findByAction(String action);

    List<ApplicationHistory> findByApplicationIdOrderByCreatedAtDesc(Long applicationId);
}
