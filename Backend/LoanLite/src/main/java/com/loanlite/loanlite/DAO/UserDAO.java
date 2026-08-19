package com.loanlite.loanlite.DAO;

import java.util.Optional;
import com.loanlite.loanlite.entities.User;

public interface UserDAO {
    Optional<User> findByEmail(String email);

    Optional<User> findByPhone(String phone);
}
