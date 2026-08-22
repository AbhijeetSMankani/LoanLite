package com.loanlite.loanlite.DAO;

import com.loanlite.loanlite.entities.LoanApplication;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface LoanApplicationDAO {

    Optional<LoanApplication> findByApplicationNumber(String applicationNumber);

    List<LoanApplication> findByApplicantId(Long applicantId);

    List<LoanApplication> findByProcessorId(Long processorId);

    List<LoanApplication> findByUnderwriterId(Long underwriterId);

    // Atomic conditional claim: single UPDATE ... WHERE id = ? AND status = ?, returns the
    // number of rows changed (0 or 1). Used instead of read-check-then-save to close the claim
    // race window - two concurrent callers can no longer both pass a Java-side status check
    // before either write commits, since the WHERE clause re-checks status at the database level
    // as part of the same atomic write.
    int claimForProcessor(Long id, String expectedStatus, String newStatus, Long processorId, LocalDateTime updatedAt);

    int claimForUnderwriter(Long id, String expectedStatus, String newStatus, Long underwriterId, LocalDateTime updatedAt);
}
