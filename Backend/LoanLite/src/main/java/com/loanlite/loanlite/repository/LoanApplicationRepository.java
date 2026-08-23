package com.loanlite.loanlite.repository;

import java.time.LocalDateTime;
import java.util.List;

import com.loanlite.loanlite.DAO.LoanApplicationDAO;
import com.loanlite.loanlite.entities.LoanApplication;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

@Repository
public interface LoanApplicationRepository extends JpaRepository<LoanApplication, Long>, LoanApplicationDAO,
        JpaSpecificationExecutor<LoanApplication> {

    // Single fixed filter, unlike search()'s independently-optional filters below - a plain
    // derived query method is enough, Spring Data auto-implements it (no DAO/EntityManager code
    // needed, unlike the old non-paginated findByStatus() this replaces).
    Page<LoanApplication> findByStatus(String status, Pageable pageable);

    // Admin stats (backendTodo.csv task 6) - a single GROUP BY query for the full status
    // breakdown, rather than one COUNT query per status value. Each row is [status, count].
    @Query("SELECT l.status, COUNT(l) FROM LoanApplication l GROUP BY l.status")
    List<Object[]> countGroupedByStatus();

    long countByCreatedAtGreaterThanEqual(LocalDateTime start);

    // Used for both "approved this month" and "rejected this month" - there's no dedicated
    // decidedAt timestamp on LoanApplication, so updatedAt is used as an approximation. Accurate
    // in practice since Accepted/Rejected are terminal states nothing else normally touches
    // afterward, but not a literal decision timestamp.
    long countByStatusAndUpdatedAtGreaterThanEqual(String status, LocalDateTime start);
}
