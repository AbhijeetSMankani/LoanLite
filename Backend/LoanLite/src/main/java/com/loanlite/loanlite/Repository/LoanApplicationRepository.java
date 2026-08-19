package com.loanlite.loanlite.Repository;

import com.loanlite.loanlite.DAO.LoanApplicationDAO;
import com.loanlite.loanlite.Entities.LoanApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LoanApplicationRepository extends JpaRepository<LoanApplication, Long>, LoanApplicationDAO {

}
