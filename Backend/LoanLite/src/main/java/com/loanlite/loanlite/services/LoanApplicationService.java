package com.loanlite.loanlite.services;

import com.loanlite.loanlite.repository.LoanApplicationRepository;
import com.loanlite.loanlite.entities.LoanApplication;
import jakarta.persistence.criteria.Predicate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
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

    public Page<LoanApplication> findByStatus(String status, Pageable pageable) {
        return loanApplicationRepository.findByStatus(status, pageable);
    }

    public List<LoanApplication> findByProcessorId(Long processorId) {
        return loanApplicationRepository.findByProcessorId(processorId);
    }

    public List<LoanApplication> findByUnderwriterId(Long underwriterId) {
        return loanApplicationRepository.findByUnderwriterId(underwriterId);
    }

    // Filters here are independently optional (any subset may be null), unlike findByStatus()'s
    // single fixed filter above - a Specification composes the WHERE clause dynamically and gives
    // Spring Data the matching COUNT query for free, instead of hand-building two near-duplicate
    // JPQL strings (one with LIMIT/OFFSET, one for COUNT) the way this used to work.
    public Page<LoanApplication> search(String status, Long processorId, Long underwriterId, Long applicantId,
                                         Pageable pageable) {
        Specification<LoanApplication> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (status != null) predicates.add(cb.equal(root.get("status"), status));
            if (processorId != null) predicates.add(cb.equal(root.get("processor").get("id"), processorId));
            if (underwriterId != null) predicates.add(cb.equal(root.get("underwriter").get("id"), underwriterId));
            if (applicantId != null) predicates.add(cb.equal(root.get("applicant").get("id"), applicantId));
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return loanApplicationRepository.findAll(spec, pageable);
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

    // Atomic conditional claim, closing the race between two staff members claiming the same
    // application (featuresTodo.csv task 6): a single UPDATE ... WHERE id = ? AND status = ?
    // re-checks status at the database level as part of the write itself, instead of the old
    // read-check-then-save pattern where two concurrent callers could both pass the Java-side
    // check before either write landed. Empty means someone else's write already moved the
    // status - the caller lost the race. Neither method pre-loads the entity into this
    // transaction's persistence context, so the getApplication(id) below always issues a fresh
    // SELECT and reflects the update just performed, rather than a stale cached instance.
    @Transactional
    public Optional<LoanApplication> claimForProcessor(Long id, String expectedStatus, String newStatus, Long processorId) {
        int updated = loanApplicationRepository.claimForProcessor(id, expectedStatus, newStatus, processorId, LocalDateTime.now());
        return updated == 0 ? Optional.empty() : Optional.of(getApplication(id));
    }

    @Transactional
    public Optional<LoanApplication> claimForUnderwriter(Long id, String expectedStatus, String newStatus, Long underwriterId) {
        int updated = loanApplicationRepository.claimForUnderwriter(id, expectedStatus, newStatus, underwriterId, LocalDateTime.now());
        return updated == 0 ? Optional.empty() : Optional.of(getApplication(id));
    }

    public void deleteApplication(Long id) {
        if (!loanApplicationRepository.existsById(id)) {
            throw new RuntimeException("Loan application not found with id: " + id);
        }
        loanApplicationRepository.deleteById(id);
    }



}
