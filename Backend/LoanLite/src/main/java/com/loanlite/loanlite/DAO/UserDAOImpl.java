package com.loanlite.loanlite.DAO;

import com.loanlite.loanlite.DAO.UserDAO;
import com.loanlite.loanlite.entities.User;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class UserDAOImpl implements UserDAO {

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public Optional<User> findByEmail(String email) {

        List<User> users = entityManager
                .createQuery(
                        "SELECT u FROM User u WHERE u.email = :email",
                        User.class
                )
                .setParameter("email", email)
                .getResultList();

        return users.stream().findFirst();
    }

    @Override
    public Optional<User> findByPhone(String phone) {

        List<User> users = entityManager
                .createQuery(
                        "SELECT u FROM User u WHERE u.phone = :phone",
                        User.class
                )
                .setParameter("phone", phone)
                .getResultList();

        return users.stream().findFirst();
    }
}