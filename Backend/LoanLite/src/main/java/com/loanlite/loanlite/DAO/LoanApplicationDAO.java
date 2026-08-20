package com.loanlite.loanlite.DAO;

import com.loanlite.loanlite.entities.LoanApplication;
import java.util.List;
import java.util.Optional;

public interface LoanApplicationDAO {

    Optional<LoanApplication> findByApplicationNumber(String applicationNumber);

    List<LoanApplication> findByApplicantId(Long applicantId);

    List<LoanApplication> findByStatus(String status);

    List<LoanApplication> findByProcessorId(Long processorId);

    List<LoanApplication> findByUnderwriterId(Long underwriterId);

    List<LoanApplication> search(String status, Long processorId, Long underwriterId, Long applicantId);
}
