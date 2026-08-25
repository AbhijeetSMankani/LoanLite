package com.loanlite.loanlite.security.jwt;

import org.junit.jupiter.api.Test;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;

import java.lang.reflect.Field;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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

    @Test
    public void validateToken_throwsExpiredJwtExceptionForExpiredToken() throws Exception {
        // The underlying JJWT parser rejects an already-expired token during parsing itself
        // (io.jsonwebtoken.ExpiredJwtException), before JwtUtil.isTokenExpired/validateToken get a
        // chance to inspect the expiration date and return a boolean - so both propagate the
        // exception rather than returning true/false for a token that expired before parsing.
        JwtUtil jwtUtil = new JwtUtil();
        setField(jwtUtil, "secret", "0123456789abcdefghijklmnopqrstuvwx");
        setField(jwtUtil, "expirationMs", 1L);

        UserDetails ud = User.withUsername("test@example.com")
                .password("ignored")
                .authorities("ROLE_USER")
                .build();

        String token = jwtUtil.generateToken(ud);
        Thread.sleep(50);

        assertThatThrownBy(() -> jwtUtil.isTokenExpired(token))
                .isInstanceOf(io.jsonwebtoken.ExpiredJwtException.class);
        assertThatThrownBy(() -> jwtUtil.validateToken(token, ud))
                .isInstanceOf(io.jsonwebtoken.ExpiredJwtException.class);
    }

    @Test
    public void validateToken_returnsFalseWhenUsernameMismatched() throws Exception {
        JwtUtil jwtUtil = new JwtUtil();
        setField(jwtUtil, "secret", "0123456789abcdefghijklmnopqrstuvwx");
        setField(jwtUtil, "expirationMs", 60000L);

        UserDetails alice = User.withUsername("alice@example.com")
                .password("ignored")
                .authorities("ROLE_USER")
                .build();
        UserDetails bob = User.withUsername("bob@example.com")
                .password("ignored")
                .authorities("ROLE_USER")
                .build();

        String token = jwtUtil.generateToken(alice);

        assertThat(jwtUtil.validateToken(token, bob)).isFalse();
    }

    @Test
    public void extractUsername_throwsForTamperedToken() throws Exception {
        JwtUtil jwtUtil = new JwtUtil();
        setField(jwtUtil, "secret", "0123456789abcdefghijklmnopqrstuvwx");
        setField(jwtUtil, "expirationMs", 60000L);

        UserDetails ud = User.withUsername("test@example.com")
                .password("ignored")
                .authorities("ROLE_USER")
                .build();

        String token = jwtUtil.generateToken(ud);
        // Corrupt the signature portion (after the last '.') so the token fails signature verification.
        int lastDot = token.lastIndexOf('.');
        String signature = token.substring(lastDot + 1);
        char flipped = signature.charAt(0) == 'A' ? 'B' : 'A';
        String tamperedToken = token.substring(0, lastDot + 1) + flipped + signature.substring(1);

        assertThatThrownBy(() -> jwtUtil.extractUsername(tamperedToken))
                .isInstanceOf(Exception.class);
    }

    private void setField(Object target, String name, Object value) throws Exception {
        Field f = target.getClass().getDeclaredField(name);
        f.setAccessible(true);
        f.set(target, value);
    }
}
