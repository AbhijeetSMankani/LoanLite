package com.loanlite.loanlite.repository;

import com.loanlite.loanlite.DAO.UserDAO;
import com.loanlite.loanlite.entities.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserRepository extends JpaRepository<User, Long>, UserDAO {
}
