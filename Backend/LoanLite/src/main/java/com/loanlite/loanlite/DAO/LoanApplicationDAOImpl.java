package com.loanlite.loanlite.DAO;

import com.loanlite.loanlite.entities.LoanApplication;
import com.loanlite.loanlite.DAO.LoanApplicationDAO;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Repository;

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
    public List<LoanApplication> findByStatus(String status) {
        return entityManager
                .createQuery("SELECT l FROM LoanApplication l WHERE l.status = :status", LoanApplication.class)
                .setParameter("status", status)
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
}
