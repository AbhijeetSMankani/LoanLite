package com.loanlite.loanlite.Services;

import com.loanlite.loanlite.DAO.UserDAO;
import com.loanlite.loanlite.Entities.User;
import com.loanlite.loanlite.Repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class UserService {
    private final UserRepository userRepository;
    private final UserDAO userDAO;


    public UserService(UserRepository userRepository, UserDAO userDAO) {
        this.userRepository = userRepository;
        this.userDAO = userDAO;
    }

    public User createUser(User user) {
        if (user.getEmail() != null && userDAO.findByEmail(user.getEmail()).isPresent()) {
            throw new RuntimeException("User already exists with email: " + user.getEmail());
        }
        if (user.getPhone() != null && userDAO.findByPhone(user.getPhone()).isPresent()) {
            throw new RuntimeException("User already exists with phone: " + user.getPhone());
        }

        user.setCreatedAt(LocalDateTime.now());
        return userRepository.save(user);
    }

    public User getUser(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found with id: " + id));
    }

    public List<User> listUsers() {
        return userRepository.findAll();
    }

    @Transactional
    public User updateUser(Long id, User user) {
        User existing = getUser(id);

        if (user.getEmail() != null && !user.getEmail().equals(existing.getEmail())) {
            if (userDAO.findByEmail(user.getEmail()).filter(u -> !u.getId().equals(id)).isPresent()) {
                throw new RuntimeException("User already exists with email: " + user.getEmail());
            }
            existing.setEmail(user.getEmail());
        }

        if (user.getPasswordHash() != null) existing.setPasswordHash(user.getPasswordHash());
        if (user.getFirstName() != null) existing.setFirstName(user.getFirstName());
        if (user.getLastName() != null) existing.setLastName(user.getLastName());

        if (user.getPhone() != null && !user.getPhone().equals(existing.getPhone())) {
            if (userDAO.findByPhone(user.getPhone()).filter(u -> !u.getId().equals(id)).isPresent()) {
                throw new RuntimeException("User already exists with phone: " + user.getPhone());
            }
            existing.setPhone(user.getPhone());
        }

        if (user.getRole() != null) existing.setRole(user.getRole());
        return userRepository.save(existing);
    }

    public void deleteUser(Long id) {
        if (!userRepository.existsById(id)) {
            throw new RuntimeException("User not found with id: " + id);
        }
        userRepository.deleteById(id);
    }
    public Optional<User> findByEmail(String email) {
        return userDAO.findByEmail(email);
    }

    public Optional<User> findByPhone(String phone) {
        return userDAO.findByPhone(phone);
    }
}
