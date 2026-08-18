package com.loanlite.loanlite.Repository;

import com.loanlite.loanlite.entities.LoanApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LoanApplicationRepository extends JpaRepository<LoanApplication, Long> {
    Optional<LoanApplication> findByApplicationNumber(String applicationNumber);
    List<LoanApplication> findByApplicantId(Long applicantId);
    List<LoanApplication> findByStatus(String status);
    List<LoanApplication> findByProcessorId(Long processorId);
    List<LoanApplication> findByUnderwriterId(Long underwriterId);
}
