package com.loanlite.loanlite.services;

import com.loanlite.loanlite.entities.User;
import com.loanlite.loanlite.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class UserService {
    @Autowired
    private UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(PasswordEncoder passwordEncoder) {
        this.passwordEncoder = passwordEncoder;
    }

    public User createUser(User user) {
        if (user.getEmail() == null) throw new IllegalArgumentException("email required");
        if (user.getPasswordHash() == null) throw new IllegalArgumentException("password required");
        Optional<User> existing = userRepository.findByEmail(user.getEmail());
        if (existing.isPresent()) throw new IllegalArgumentException("email already in use");

        user.setPasswordHash(passwordEncoder.encode(user.getPasswordHash()));
        user.setCreatedAt(LocalDateTime.now());
        if (user.getRole() == null) user.setRole("ROLE_USER");
        return userRepository.save(user);
    }

    public User getUser(Long id) {
        return userRepository.findById(id).orElseThrow(() -> new RuntimeException("User not found"));
    }

    public List<User> listUsers() {
        return userRepository.findAll();
    }

    @Transactional
    public User updateUser(Long id, User user) {
        User existing = userRepository.findById(id).orElseThrow(() -> new RuntimeException("User not found"));
        if (user.getEmail() != null) existing.setEmail(user.getEmail());
        if (user.getFirstName() != null) existing.setFirstName(user.getFirstName());
        if (user.getLastName() != null) existing.setLastName(user.getLastName());
        if (user.getPhone() != null) existing.setPhone(user.getPhone());
        if (user.getRole() != null) existing.setRole(user.getRole());
        if (user.getPasswordHash() != null && !user.getPasswordHash().isBlank()) {
            existing.setPasswordHash(passwordEncoder.encode(user.getPasswordHash()));
        }
        return userRepository.save(existing);
    }

    public void deleteUser(Long id) {
        if (!userRepository.existsById(id)) {
            throw new RuntimeException("User not found with id: " + id);
        }
        userRepository.deleteById(id);
    }

    public Optional<User> findByEmail(String email) {
        return userRepository.findByEmail(email);
    }

    public Optional<User> findByPhone(String phone) {
        return userRepository.findByPhone(phone);
    }
}

