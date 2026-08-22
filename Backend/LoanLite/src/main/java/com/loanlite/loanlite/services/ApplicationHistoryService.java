package com.loanlite.loanlite.services;

import com.loanlite.loanlite.DAO.ApplicationHistoryDAO;
import com.loanlite.loanlite.repository.ApplicationHistoryRepository;
import com.loanlite.loanlite.entities.ApplicationHistory;
import com.loanlite.loanlite.entities.LoanApplication;
import com.loanlite.loanlite.entities.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ApplicationHistoryService {

    @Autowired
    private ApplicationHistoryRepository applicationHistoryRepository;

    public ApplicationHistory createHistory(ApplicationHistory h) {
        if (h.getCreatedAt() == null) {
            h.setCreatedAt(LocalDateTime.now());
        }
        return applicationHistoryRepository.save(h);
    }

    // Called directly from controller actions (submit, withdraw, claim, verify,
    // document status change) to record an audit entry as a side effect of that
    // action - not through the ADMIN-only HTTP endpoint above, which stays
    // locked down to manual/administrative writes only.
    public ApplicationHistory log(LoanApplication application, User user, String action, String details) {
        ApplicationHistory h = new ApplicationHistory();
        h.setApplication(application);
        h.setUser(user);
        h.setAction(action);
        h.setDetails(details);
        h.setCreatedAt(LocalDateTime.now());
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
        return applicationHistoryRepository.findByApplicationId(applicationId);
    }

    public List<ApplicationHistory> findByUserId(Long userId) {
        return applicationHistoryRepository.findByUserId(userId);
    }

    public List<ApplicationHistory> findByAction(String action) {
        return applicationHistoryRepository.findByAction(action);
    }

    public List<ApplicationHistory> findByApplicationIdOrderByCreatedAtDesc(Long applicationId) {
        return applicationHistoryRepository.findByApplicationIdOrderByCreatedAtDesc(applicationId);
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
