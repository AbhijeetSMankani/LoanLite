package com.loanlite.loanlite.Services;

import com.loanlite.loanlite.Repository.LoanApplicationRepository;
import com.loanlite.loanlite.Entities.LoanApplication;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class LoanApplicationService {

    @Autowired
    private LoanApplicationRepository loanApplicationRepository;

//    public LoanApplicationService(LoanApplicationRepository loanApplicationRepository, loanApplicationRepository loanApplicationRepository) {
//        this.loanApplicationRepository = loanApplicationRepository;
//        this.loanApplicationRepository = loanApplicationRepository;
//    }

    public LoanApplication createApplication(LoanApplication app) {
        if (app.getApplicationNumber() != null && loanApplicationRepository.findByApplicationNumber(app.getApplicationNumber()).isPresent()) {
            throw new RuntimeException("Loan application already exists with application number: " + app.getApplicationNumber());
        }

        if (app.getCreatedAt() == null) {
            app.setCreatedAt(LocalDateTime.now());
        }
        if (app.getUpdatedAt() == null) {
            app.setUpdatedAt(LocalDateTime.now());
        }
        return loanApplicationRepository.save(app);
    }

    public LoanApplication getApplication(Long id) {
        return loanApplicationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Loan application not found with id: " + id));
    }

    public List<LoanApplication> listApplications() {
        return loanApplicationRepository.findAll();
    }

    public Optional<LoanApplication> findByApplicationNumber(String applicationNumber) {
        return loanApplicationRepository.findByApplicationNumber(applicationNumber);
    }

    public List<LoanApplication> findByApplicantId(Long applicantId) {
        return loanApplicationRepository.findByApplicantId(applicantId);
    }

    public List<LoanApplication> findByStatus(String status) {
        return loanApplicationRepository.findByStatus(status);
    }

    public List<LoanApplication> findByProcessorId(Long processorId) {
        return loanApplicationRepository.findByProcessorId(processorId);
    }

    public List<LoanApplication> findByUnderwriterId(Long underwriterId) {
        return loanApplicationRepository.findByUnderwriterId(underwriterId);
    }

    @Transactional
    public LoanApplication updateApplication(Long id, LoanApplication app) {
        LoanApplication existing = getApplication(id);

        if (app.getApplicationNumber() != null && !app.getApplicationNumber().equals(existing.getApplicationNumber())) {
            if (loanApplicationRepository.findByApplicationNumber(app.getApplicationNumber())
                    .filter(existingApp -> !existingApp.getId().equals(id))
                    .isPresent()) {
                throw new RuntimeException("Loan application already exists with application number: " + app.getApplicationNumber());
            }
            existing.setApplicationNumber(app.getApplicationNumber());
        }

        if (app.getApplicant() != null) existing.setApplicant(app.getApplicant());
        if (app.getLoanAmount() != null) existing.setLoanAmount(app.getLoanAmount());
        if (app.getTenureMonths() != null) existing.setTenureMonths(app.getTenureMonths());
        if (app.getDeclaredIncome() != null) existing.setDeclaredIncome(app.getDeclaredIncome());
        if (app.getVerifiedIncome() != null) existing.setVerifiedIncome(app.getVerifiedIncome());
        if (app.getCreditScore() != null) existing.setCreditScore(app.getCreditScore());
        if (app.getInterestRate() != null) existing.setInterestRate(app.getInterestRate());
        if (app.getEmi() != null) existing.setEmi(app.getEmi());
        if (app.getStatus() != null) existing.setStatus(app.getStatus());
        if (app.getRecommendation() != null) existing.setRecommendation(app.getRecommendation());
        if (app.getRecommendationReason() != null) existing.setRecommendationReason(app.getRecommendationReason());
        if (app.getDecision() != null) existing.setDecision(app.getDecision());
        if (app.getDecisionComments() != null) existing.setDecisionComments(app.getDecisionComments());
        if (app.getProcessor() != null) existing.setProcessor(app.getProcessor());
        if (app.getUnderwriter() != null) existing.setUnderwriter(app.getUnderwriter());
        if (app.getSubmittedAt() != null) existing.setSubmittedAt(app.getSubmittedAt());

        existing.setUpdatedAt(LocalDateTime.now());
        return loanApplicationRepository.save(existing);
    }

    public void deleteApplication(Long id) {
        if (!loanApplicationRepository.existsById(id)) {
            throw new RuntimeException("Loan application not found with id: " + id);
        }
        loanApplicationRepository.deleteById(id);
    }



}
