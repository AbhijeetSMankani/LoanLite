package com.loanlite.loanlite.entities;

import com.loanlite.loanlite.entities.Document;
import com.loanlite.loanlite.validation.ValidTenure;
import jakarta.persistence.*;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonManagedReference;

@Entity
@Table(name = "loan_applications")
public class LoanApplication {

    // Shared with LoanApplicationController.update()'s manual partial-field checks, so the range
    // has one source of truth instead of the annotation's literal drifting from a duplicated
    // hardcoded check (backendTodo.csv task 7).
    public static final String MIN_LOAN_AMOUNT = "50000";
    public static final String MAX_LOAN_AMOUNT = "2500000";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "application_number", unique = true)
    private String applicationNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "applicant_id")
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User applicant;

    // Range per the project charter's stated loan product rules (Rs.50,000-Rs.25,00,000).
    // Enforced only where @Valid is explicitly wired (LoanApplicationController.create()) - see
    // application.properties' jakarta.persistence.validation.mode=none for why this isn't also
    // enforced automatically on every JPA flush (backendTodo.csv task 7).
    @Column(name = "loan_amount")
    @NotNull(message = "loanAmount is required")
    @DecimalMin(value = MIN_LOAN_AMOUNT, message = "loanAmount must be at least " + MIN_LOAN_AMOUNT)
    @DecimalMax(value = MAX_LOAN_AMOUNT, message = "loanAmount must be at most " + MAX_LOAN_AMOUNT)
    private BigDecimal loanAmount;

    // Discrete set per the project charter, not a range - see ValidTenure.
    @Column(name = "tenure_months")
    @NotNull(message = "tenureMonths is required")
    @ValidTenure
    private Integer tenureMonths;

    @Column(name = "declared_income")
    @NotNull(message = "declaredIncome is required")
    @DecimalMin(value = "0", inclusive = false, message = "declaredIncome must be greater than 0")
    private BigDecimal declaredIncome;

    @Column(name = "verified_income")
    private BigDecimal verifiedIncome;

    @Column(name = "credit_score")
    private Integer creditScore;

    @Column(name = "interest_rate")
    private BigDecimal interestRate;

    private BigDecimal emi;

    @Column(name = "status")
    private String status;

    @Column(name = "recommendation")
    private String recommendation;

    @Column(name = "recommendation_reason")
    private String recommendationReason;

    @Column(name = "decision")
    private String decision;

    @Column(name = "decision_comments")
    private String decisionComments;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "processor_id")
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User processor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "underwriter_id")
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User underwriter;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @JsonManagedReference(value = "documents")
    @OneToMany(mappedBy = "application", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Document> documents = new ArrayList<>();

    @JsonManagedReference(value = "history")
    @OneToMany(mappedBy = "application", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ApplicationHistory> applicationHistory = new ArrayList<>();

    public LoanApplication() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getApplicationNumber() {
        return applicationNumber;
    }

    public void setApplicationNumber(String applicationNumber) {
        this.applicationNumber = applicationNumber;
    }

    public User getApplicant() {
        return applicant;
    }

    public void setApplicant(User applicant) {
        this.applicant = applicant;
    }

    public BigDecimal getLoanAmount() {
        return loanAmount;
    }

    public void setLoanAmount(BigDecimal loanAmount) {
        this.loanAmount = loanAmount;
    }

    public Integer getTenureMonths() {
        return tenureMonths;
    }

    public void setTenureMonths(Integer tenureMonths) {
        this.tenureMonths = tenureMonths;
    }

    public BigDecimal getDeclaredIncome() {
        return declaredIncome;
    }

    public void setDeclaredIncome(BigDecimal declaredIncome) {
        this.declaredIncome = declaredIncome;
    }

    public BigDecimal getVerifiedIncome() {
        return verifiedIncome;
    }

    public void setVerifiedIncome(BigDecimal verifiedIncome) {
        this.verifiedIncome = verifiedIncome;
    }

    public Integer getCreditScore() {
        return creditScore;
    }

    public void setCreditScore(Integer creditScore) {
        this.creditScore = creditScore;
    }

    public BigDecimal getInterestRate() {
        return interestRate;
    }

    public void setInterestRate(BigDecimal interestRate) {
        this.interestRate = interestRate;
    }

    public BigDecimal getEmi() {
        return emi;
    }

    public void setEmi(BigDecimal emi) {
        this.emi = emi;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getRecommendation() {
        return recommendation;
    }

    public void setRecommendation(String recommendation) {
        this.recommendation = recommendation;
    }

    public String getRecommendationReason() {
        return recommendationReason;
    }

    public void setRecommendationReason(String recommendationReason) {
        this.recommendationReason = recommendationReason;
    }

    public String getDecision() {
        return decision;
    }

    public void setDecision(String decision) {
        this.decision = decision;
    }

    public String getDecisionComments() {
        return decisionComments;
    }

    public void setDecisionComments(String decisionComments) {
        this.decisionComments = decisionComments;
    }

    public User getProcessor() {
        return processor;
    }

    public void setProcessor(User processor) {
        this.processor = processor;
    }

    public User getUnderwriter() {
        return underwriter;
    }

    public void setUnderwriter(User underwriter) {
        this.underwriter = underwriter;
    }

    public LocalDateTime getSubmittedAt() {
        return submittedAt;
    }

    public void setSubmittedAt(LocalDateTime submittedAt) {
        this.submittedAt = submittedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public List<Document> getDocuments() {
        return documents;
    }

    public void setDocuments(List<Document> documents) {
        this.documents = documents;
    }

    public List<ApplicationHistory> getApplicationHistory() {
        return applicationHistory;
    }

    public void setApplicationHistory(List<ApplicationHistory> applicationHistory) {
        this.applicationHistory = applicationHistory;
    }
}
