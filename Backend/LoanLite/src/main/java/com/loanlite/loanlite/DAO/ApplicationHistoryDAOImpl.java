package com.loanlite.loanlite.DAO;

import com.loanlite.loanlite.entities.ApplicationHistory;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class ApplicationHistoryDAOImpl implements ApplicationHistoryDAO {

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public List<ApplicationHistory> findByApplicationId(Long applicationId) {
        return entityManager
                .createQuery(
                        "SELECT ah FROM ApplicationHistory ah WHERE ah.application.id = :applicationId",
                        ApplicationHistory.class
                )
                .setParameter("applicationId", applicationId)
                .getResultList();
    }

    @Override
    public List<ApplicationHistory> findByUserId(Long userId) {
        return entityManager
                .createQuery(
                        "SELECT ah FROM ApplicationHistory ah WHERE ah.user.id = :userId",
                        ApplicationHistory.class
                )
                .setParameter("userId", userId)
                .getResultList();
    }

    @Override
    public List<ApplicationHistory> findByAction(String action) {
        return entityManager
                .createQuery(
                        "SELECT ah FROM ApplicationHistory ah WHERE ah.action = :action",
                        ApplicationHistory.class
                )
                .setParameter("action", action)
                .getResultList();
    }

    @Override
    public List<ApplicationHistory> findByApplicationIdOrderByCreatedAtDesc(Long applicationId) {
        return entityManager
                .createQuery(
                        "SELECT ah FROM ApplicationHistory ah WHERE ah.application.id = :applicationId ORDER BY ah.createdAt DESC",
                        ApplicationHistory.class
                )
                .setParameter("applicationId", applicationId)
                .getResultList();
    }
}
