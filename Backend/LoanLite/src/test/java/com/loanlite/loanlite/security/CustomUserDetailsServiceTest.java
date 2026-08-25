package com.loanlite.loanlite.security;

import com.loanlite.loanlite.entities.User;
import com.loanlite.loanlite.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class CustomUserDetailsServiceTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private CustomUserDetailsService customUserDetailsService;

    @Test
    public void loadUserByUsername_returnsUserDetailsWithRoleAsAuthority() {
        User user = new User();
        user.setEmail("user@example.com");
        user.setPasswordHash("hashed-password");
        user.setRole("ROLE_ADMIN");

        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));

        UserDetails result = customUserDetailsService.loadUserByUsername("user@example.com");

        assertThat(result.getUsername()).isEqualTo("user@example.com");
        assertThat(result.getPassword()).isEqualTo("hashed-password");
        assertThat(result.getAuthorities())
                .extracting(a -> a.getAuthority())
                .containsExactly("ROLE_ADMIN");
    }

    @Test
    public void loadUserByUsername_defaultsToRoleUserWhenRoleIsNull() {
        User user = new User();
        user.setEmail("user@example.com");
        user.setPasswordHash("hashed-password");
        user.setRole(null);

        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));

        UserDetails result = customUserDetailsService.loadUserByUsername("user@example.com");

        assertThat(result.getAuthorities())
                .extracting(a -> a.getAuthority())
                .containsExactly("ROLE_USER");
    }

    @Test
    public void loadUserByUsername_throwsWhenUserNotFound() {
        when(userRepository.findByEmail("missing@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> customUserDetailsService.loadUserByUsername("missing@example.com"))
                .isInstanceOf(UsernameNotFoundException.class);
    }
}
