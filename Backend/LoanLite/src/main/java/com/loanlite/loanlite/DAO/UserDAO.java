package com.loanlite.loanlite.DAO;

import java.util.Optional;

public interface UserDAO {
    Optional<com.loanlite.loanlite.Entities.User> findByEmail(String email);

    Optional<com.loanlite.loanlite.Entities.User> findByPhone(String phone);
}
