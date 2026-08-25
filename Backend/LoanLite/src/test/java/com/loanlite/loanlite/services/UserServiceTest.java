package com.loanlite.loanlite.services;

import com.loanlite.loanlite.entities.User;
import com.loanlite.loanlite.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Collections;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private UserService userService;

    // @InjectMocks only performs ONE of constructor injection or field injection for a given
    // instance, not both - since UserService has a constructor for passwordEncoder, Mockito uses
    // constructor injection and never populates the separate @Autowired userRepository field.
    // Wire it manually so both collaborators are mocked.
    @BeforeEach
    void wireUserRepository() {
        ReflectionTestUtils.setField(userService, "userRepository", userRepository);
    }

    @Test
    void createUser_nullEmail_throwsIllegalArgumentException() {
        User user = new User();
        user.setEmail(null);
        user.setPasswordHash("secret");

        assertThatThrownBy(() -> userService.createUser(user)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void createUser_nullPasswordHash_throwsIllegalArgumentException() {
        User user = new User();
        user.setEmail("a@b.com");
        user.setPasswordHash(null);

        assertThatThrownBy(() -> userService.createUser(user)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void createUser_emailAlreadyInUse_throwsIllegalArgumentException() {
        User user = new User();
        user.setEmail("a@b.com");
        user.setPasswordHash("secret");

        when(userRepository.findByEmail("a@b.com")).thenReturn(Optional.of(new User()));

        assertThatThrownBy(() -> userService.createUser(user)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void createUser_happyPathNoRole_defaultsRoleAndEncodesPassword() {
        User user = new User();
        user.setEmail("a@b.com");
        user.setPasswordHash("secret");
        user.setRole(null);

        when(userRepository.findByEmail("a@b.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("secret")).thenReturn("encoded-secret");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        User result = userService.createUser(user);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        User saved = captor.getValue();

        verify(passwordEncoder).encode("secret");
        assertThat(saved.getPasswordHash()).isEqualTo("encoded-secret");
        assertThat(saved.getRole()).isEqualTo("ROLE_USER");
        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(result).isSameAs(saved);
    }

    @Test
    void createUser_happyPathRoleAlreadySet_doesNotOverwriteRole() {
        User user = new User();
        user.setEmail("a@b.com");
        user.setPasswordHash("secret");
        user.setRole("ROLE_ADMIN");

        when(userRepository.findByEmail("a@b.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("secret")).thenReturn("encoded-secret");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        User result = userService.createUser(user);

        assertThat(result.getRole()).isEqualTo("ROLE_ADMIN");
    }

    @Test
    void getUser_found_returnsEntity() {
        User user = new User();
        user.setId(1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        User result = userService.getUser(1L);

        assertThat(result).isSameAs(user);
    }

    @Test
    void getUser_notFound_throws() {
        when(userRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.getUser(1L)).isInstanceOf(RuntimeException.class);
    }

    @Test
    void listUsers_delegatesToRepository() {
        Pageable pageable = mock(Pageable.class);
        Page<User> page = new PageImpl<>(Collections.emptyList());
        when(userRepository.findAll(pageable)).thenReturn(page);

        Page<User> result = userService.listUsers(pageable);

        assertThat(result).isSameAs(page);
        verify(userRepository).findAll(pageable);
    }

    @Test
    void updateUser_notFound_throws() {
        when(userRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.updateUser(1L, new User())).isInstanceOf(RuntimeException.class);
    }

    @Test
    void updateUser_emailUsedByDifferentUser_throwsIllegalArgumentException() {
        User existing = new User();
        existing.setId(1L);
        existing.setEmail("old@b.com");

        User update = new User();
        update.setEmail("new@b.com");

        User otherUser = new User();
        otherUser.setId(2L);

        when(userRepository.findById(1L)).thenReturn(Optional.of(existing));
        when(userRepository.findByEmail("new@b.com")).thenReturn(Optional.of(otherUser));

        assertThatThrownBy(() -> userService.updateUser(1L, update)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void updateUser_emailSameAsCurrent_isAllowed() {
        User existing = new User();
        existing.setId(1L);
        existing.setEmail("same@b.com");
        existing.setFirstName("John");

        User update = new User();
        update.setEmail("same@b.com");

        when(userRepository.findById(1L)).thenReturn(Optional.of(existing));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        User result = userService.updateUser(1L, update);

        assertThat(result.getEmail()).isEqualTo("same@b.com");
        assertThat(result.getFirstName()).isEqualTo("John");
    }

    @Test
    void updateUser_partialUpdate_onlyOverwritesNonNullFields() {
        User existing = new User();
        existing.setId(1L);
        existing.setEmail("a@b.com");
        existing.setFirstName("John");
        existing.setLastName("Doe");
        existing.setPhone("12345");
        existing.setRole("ROLE_USER");

        User update = new User();
        update.setFirstName("Jane");

        when(userRepository.findById(1L)).thenReturn(Optional.of(existing));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        User result = userService.updateUser(1L, update);

        assertThat(result.getFirstName()).isEqualTo("Jane");
        assertThat(result.getLastName()).isEqualTo("Doe");
        assertThat(result.getEmail()).isEqualTo("a@b.com");
        assertThat(result.getPhone()).isEqualTo("12345");
        assertThat(result.getRole()).isEqualTo("ROLE_USER");
    }

    @Test
    void updateUser_blankPasswordHash_doesNotRehash() {
        User existing = new User();
        existing.setId(1L);
        existing.setPasswordHash("old-hash");

        User update = new User();
        update.setPasswordHash("   ");

        when(userRepository.findById(1L)).thenReturn(Optional.of(existing));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        User result = userService.updateUser(1L, update);

        assertThat(result.getPasswordHash()).isEqualTo("old-hash");
        verify(passwordEncoder, never()).encode(any());
    }

    @Test
    void updateUser_realPasswordHash_getsRehashed() {
        User existing = new User();
        existing.setId(1L);
        existing.setPasswordHash("old-hash");

        User update = new User();
        update.setPasswordHash("new-raw-password");

        when(userRepository.findById(1L)).thenReturn(Optional.of(existing));
        when(passwordEncoder.encode("new-raw-password")).thenReturn("new-encoded");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        User result = userService.updateUser(1L, update);

        assertThat(result.getPasswordHash()).isEqualTo("new-encoded");
    }

    @Test
    void deleteUser_notFound_throws() {
        when(userRepository.existsById(1L)).thenReturn(false);

        assertThatThrownBy(() -> userService.deleteUser(1L)).isInstanceOf(RuntimeException.class);
    }

    @Test
    void deleteUser_found_deletesById() {
        when(userRepository.existsById(1L)).thenReturn(true);

        userService.deleteUser(1L);

        verify(userRepository).deleteById(1L);
    }

    @Test
    void changePassword_wrongCurrentPassword_throwsIllegalArgumentException() {
        User user = new User();
        user.setId(1L);
        user.setPasswordHash("stored-hash");

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong", "stored-hash")).thenReturn(false);

        assertThatThrownBy(() -> userService.changePassword(1L, "wrong", "newPass"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void changePassword_nullCurrentPassword_throwsWithoutCallingMatches() {
        User user = new User();
        user.setId(1L);
        user.setPasswordHash("stored-hash");

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> userService.changePassword(1L, null, "newPass"))
                .isInstanceOf(IllegalArgumentException.class);

        verify(passwordEncoder, never()).matches(any(), any());
    }

    @Test
    void changePassword_nullNewPassword_throwsIllegalArgumentException() {
        User user = new User();
        user.setId(1L);
        user.setPasswordHash("stored-hash");

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("current", "stored-hash")).thenReturn(true);

        assertThatThrownBy(() -> userService.changePassword(1L, "current", null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void changePassword_blankNewPassword_throwsIllegalArgumentException() {
        User user = new User();
        user.setId(1L);
        user.setPasswordHash("stored-hash");

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("current", "stored-hash")).thenReturn(true);

        assertThatThrownBy(() -> userService.changePassword(1L, "current", "   "))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void changePassword_happyPath_encodesAndSavesNewPassword() {
        User user = new User();
        user.setId(1L);
        user.setPasswordHash("stored-hash");

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("current", "stored-hash")).thenReturn(true);
        when(passwordEncoder.encode("newPass")).thenReturn("new-encoded");

        userService.changePassword(1L, "current", "newPass");

        verify(passwordEncoder).encode("newPass");
        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertThat(captor.getValue().getPasswordHash()).isEqualTo("new-encoded");
    }

    @Test
    void findByEmail_delegatesToRepository() {
        User user = new User();
        when(userRepository.findByEmail("a@b.com")).thenReturn(Optional.of(user));

        Optional<User> result = userService.findByEmail("a@b.com");

        assertThat(result).contains(user);
        verify(userRepository).findByEmail("a@b.com");
    }

    @Test
    void findByPhone_delegatesToRepository() {
        User user = new User();
        when(userRepository.findByPhone("12345")).thenReturn(Optional.of(user));

        Optional<User> result = userService.findByPhone("12345");

        assertThat(result).contains(user);
        verify(userRepository).findByPhone("12345");
    }
}
