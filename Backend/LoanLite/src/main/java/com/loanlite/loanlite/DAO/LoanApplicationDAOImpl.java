package com.loanlite.loanlite.DAO;

import com.loanlite.loanlite.entities.LoanApplication;
import com.loanlite.loanlite.entities.User;
import com.loanlite.loanlite.DAO.LoanApplicationDAO;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public class LoanApplicationDAOImpl implements LoanApplicationDAO {

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public Optional<LoanApplication> findByApplicationNumber(String applicationNumber) {
        return entityManager
                .createQuery("SELECT l FROM LoanApplication l WHERE l.applicationNumber = :applicationNumber", LoanApplication.class)
                .setParameter("applicationNumber", applicationNumber)
                .getResultStream()
                .findFirst();
    }

  @Override
    public List<LoanApplication> findByApplicantId(Long applicantId) {
        return entityManager
                .createQuery("SELECT l FROM LoanApplication l WHERE l.applicant.id = :applicantId", LoanApplication.class)
                .setParameter("applicantId", applicantId)
                .getResultList();
    }

    @Override
    public List<LoanApplication> findByProcessorId(Long processorId) {
        return entityManager
                .createQuery("SELECT l FROM LoanApplication l WHERE l.processor.id = :processorId", LoanApplication.class)
                .setParameter("processorId", processorId)
                .getResultList();
    }

   @Override
    public List<LoanApplication> findByUnderwriterId(Long underwriterId) {
        return entityManager
                .createQuery("SELECT l FROM LoanApplication l WHERE l.underwriter.id = :underwriterId", LoanApplication.class)
                .setParameter("underwriterId", underwriterId)
                .getResultList();
    }

    @Override
    public int claimForProcessor(Long id, String expectedStatus, String newStatus, Long processorId, LocalDateTime updatedAt) {
        return entityManager.createQuery(
                        "UPDATE LoanApplication l SET l.status = :newStatus, l.processor = :processor, l.updatedAt = :updatedAt "
                                + "WHERE l.id = :id AND l.status = :expectedStatus")
                .setParameter("newStatus", newStatus)
                .setParameter("processor", entityManager.getReference(User.class, processorId))
                .setParameter("updatedAt", updatedAt)
                .setParameter("id", id)
                .setParameter("expectedStatus", expectedStatus)
                .executeUpdate();
    }

    @Override
    public int claimForUnderwriter(Long id, String expectedStatus, String newStatus, Long underwriterId, LocalDateTime updatedAt) {
        return entityManager.createQuery(
                        "UPDATE LoanApplication l SET l.status = :newStatus, l.underwriter = :underwriter, l.updatedAt = :updatedAt "
                                + "WHERE l.id = :id AND l.status = :expectedStatus")
                .setParameter("newStatus", newStatus)
                .setParameter("underwriter", entityManager.getReference(User.class, underwriterId))
                .setParameter("updatedAt", updatedAt)
                .setParameter("id", id)
                .setParameter("expectedStatus", expectedStatus)
                .executeUpdate();
    }
}
