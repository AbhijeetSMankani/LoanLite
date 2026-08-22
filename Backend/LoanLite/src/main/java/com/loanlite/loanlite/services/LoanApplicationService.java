package com.loanlite.loanlite.services;

import com.loanlite.loanlite.repository.LoanApplicationRepository;
import com.loanlite.loanlite.entities.LoanApplication;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class LoanApplicationService {

    // Per the project's Problem Statement: one fixed annual interest rate applies to every
    // loan - not something staff choose per application. LoanApplicationController forces
    // every create()/update() to this value regardless of what the caller sends; nothing
    // in this codebase should ever persist a caller-supplied interestRate.
    public static final BigDecimal FIXED_ANNUAL_INTEREST_RATE = new BigDecimal("12.00");

    // Standard EMI formula: EMI = [P x R x (1+R)^N] / [(1+R)^N - 1], R = monthly rate.
    // Called from createApplication()/updateApplication() themselves - not the controller -
    // so it always runs against the fully-merged entity state. Computing it in the controller
    // (like interestRate) would break on a partial update that only sends tenureMonths without
    // resending loanAmount: the pre-merge request object would have a null loanAmount, the
    // computed EMI would come back null, and updateApplication()'s null-safe merge would then
    // silently leave the OLD, now-stale EMI in place instead of recomputing it.
    public static BigDecimal calculateEmi(BigDecimal principal, Integer tenureMonths, BigDecimal annualRatePercent) {
        if (principal == null || tenureMonths == null || tenureMonths <= 0 || annualRatePercent == null) {
            return null;
        }

        BigDecimal monthlyRate = annualRatePercent.divide(new BigDecimal("1200"), MathContext.DECIMAL64);
        BigDecimal compounded = BigDecimal.ONE.add(monthlyRate).pow(tenureMonths, MathContext.DECIMAL64);
        BigDecimal denominator = compounded.subtract(BigDecimal.ONE);
        if (denominator.compareTo(BigDecimal.ZERO) == 0) {
            return null;
        }

        BigDecimal numerator = principal.multiply(monthlyRate).multiply(compounded);
        return numerator.divide(denominator, 2, RoundingMode.HALF_UP);
    }

    @Autowired
    private LoanApplicationRepository loanApplicationRepository;

    public LoanApplication createApplication(LoanApplication app) {
        if (app.getApplicationNumber() != null && loanApplicationRepository.findByApplicationNumber(app.getApplicationNumber()).isPresent()) {
            throw new RuntimeException("Loan application already exists with application number: " + app.getApplicationNumber());
        }

        app.setEmi(calculateEmi(app.getLoanAmount(), app.getTenureMonths(), app.getInterestRate()));

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

    public List<LoanApplication> search(String status, Long processorId, Long underwriterId, Long applicantId) {
        return loanApplicationRepository.search(status, processorId, underwriterId, applicantId);
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
        if (app.getStatus() != null) existing.setStatus(app.getStatus());
        if (app.getRecommendation() != null) existing.setRecommendation(app.getRecommendation());
        if (app.getRecommendationReason() != null) existing.setRecommendationReason(app.getRecommendationReason());
        if (app.getDecision() != null) existing.setDecision(app.getDecision());
        if (app.getDecisionComments() != null) existing.setDecisionComments(app.getDecisionComments());
        if (app.getProcessor() != null) existing.setProcessor(app.getProcessor());
        if (app.getUnderwriter() != null) existing.setUnderwriter(app.getUnderwriter());
        if (app.getSubmittedAt() != null) existing.setSubmittedAt(app.getSubmittedAt());

        existing.setEmi(calculateEmi(existing.getLoanAmount(), existing.getTenureMonths(), existing.getInterestRate()));
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
