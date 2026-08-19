package com.loanlite.loanlite.Services;

import com.loanlite.loanlite.DAO.ApplicationHistoryDAO;
import com.loanlite.loanlite.Repository.ApplicationHistoryRepository;
import com.loanlite.loanlite.Entities.ApplicationHistory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ApplicationHistoryService {

    private final ApplicationHistoryRepository applicationHistoryRepository;
    private final ApplicationHistoryDAO applicationHistoryDAO;

    public ApplicationHistoryService(ApplicationHistoryRepository applicationHistoryRepository,
                                    ApplicationHistoryDAO applicationHistoryDAO) {
        this.applicationHistoryRepository = applicationHistoryRepository;
        this.applicationHistoryDAO = applicationHistoryDAO;
    }

    public ApplicationHistory createHistory(ApplicationHistory h) {
        if (h.getCreatedAt() == null) {
            h.setCreatedAt(LocalDateTime.now());
        }
        return applicationHistoryRepository.save(h);
    }

    public ApplicationHistory getHistory(Long id) {
        return applicationHistoryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Application history not found with id: " + id));
    }

    public List<ApplicationHistory> listHistory() {
        return applicationHistoryRepository.findAll();
    }

    public List<ApplicationHistory> findByApplicationId(Long applicationId) {
        return applicationHistoryDAO.findByApplicationId(applicationId);
    }

    public List<ApplicationHistory> findByUserId(Long userId) {
        return applicationHistoryDAO.findByUserId(userId);
    }

    public List<ApplicationHistory> findByAction(String action) {
        return applicationHistoryDAO.findByAction(action);
    }

    public List<ApplicationHistory> findByApplicationIdOrderByCreatedAtDesc(Long applicationId) {
        return applicationHistoryDAO.findByApplicationIdOrderByCreatedAtDesc(applicationId);
    }

    @Transactional
    public ApplicationHistory updateHistory(Long id, ApplicationHistory h) {
        ApplicationHistory existing = getHistory(id);

        if (h.getApplication() != null) existing.setApplication(h.getApplication());
        if (h.getUser() != null) existing.setUser(h.getUser());
        if (h.getAction() != null) existing.setAction(h.getAction());
        if (h.getDetails() != null) existing.setDetails(h.getDetails());
        if (h.getCreatedAt() != null) existing.setCreatedAt(h.getCreatedAt());

        return applicationHistoryRepository.save(existing);
    }

    public void deleteHistory(Long id) {
        if (!applicationHistoryRepository.existsById(id)) {
            throw new RuntimeException("Application history not found with id: " + id);
        }
        applicationHistoryRepository.deleteById(id);
    }
}
