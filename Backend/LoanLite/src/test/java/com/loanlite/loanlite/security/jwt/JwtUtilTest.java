package com.loanlite.loanlite.security.jwt;

import org.junit.jupiter.api.Test;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;

import java.lang.reflect.Field;

import static org.assertj.core.api.Assertions.assertThat;

public class JwtUtilTest {

    @Test
    public void generateAndValidateToken() throws Exception {
        JwtUtil jwtUtil = new JwtUtil();
        // Set private fields via reflection
        setField(jwtUtil, "secret", "0123456789abcdefghijklmnopqrstuvwx");
        setField(jwtUtil, "expirationMs", 60000L);

        UserDetails ud = User.withUsername("test@example.com")
                .password("ignored")
                .authorities("ROLE_USER")
                .build();

        String token = jwtUtil.generateToken(ud);
        assertThat(token).isNotBlank();

        String extracted = jwtUtil.extractUsername(token);
        assertThat(extracted).isEqualTo("test@example.com");

        boolean valid = jwtUtil.validateToken(token, ud);
        assertThat(valid).isTrue();
    }

    private void setField(Object target, String name, Object value) throws Exception {
        Field f = target.getClass().getDeclaredField(name);
        f.setAccessible(true);
        f.set(target, value);
    }
}
