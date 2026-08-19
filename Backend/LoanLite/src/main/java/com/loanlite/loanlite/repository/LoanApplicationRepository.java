package com.loanlite.loanlite.repository;

import com.loanlite.loanlite.DAO.LoanApplicationDAO;
import com.loanlite.loanlite.entities.LoanApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LoanApplicationRepository extends JpaRepository<LoanApplication, Long>, LoanApplicationDAO {

}
