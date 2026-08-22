package com.loanlite.loanlite.repository;

import com.loanlite.loanlite.DAO.LoanApplicationDAO;
import com.loanlite.loanlite.entities.LoanApplication;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

@Repository
public interface LoanApplicationRepository extends JpaRepository<LoanApplication, Long>, LoanApplicationDAO,
        JpaSpecificationExecutor<LoanApplication> {

    // Single fixed filter, unlike search()'s independently-optional filters below - a plain
    // derived query method is enough, Spring Data auto-implements it (no DAO/EntityManager code
    // needed, unlike the old non-paginated findByStatus() this replaces).
    Page<LoanApplication> findByStatus(String status, Pageable pageable);
}
