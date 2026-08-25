package com.loanlite.loanlite.security;

import com.loanlite.loanlite.entities.LoanApplication;
import com.loanlite.loanlite.entities.User;
import com.loanlite.loanlite.services.UserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class LoanApplicationAccessGuardTest {

    @Mock
    private UserService userService;

    @InjectMocks
    private LoanApplicationAccessGuard accessGuard;

    @Test
    public void currentUser_throwsWhenAuthenticationIsNull() {
        try (MockedStatic<SecurityContextHolder> mockedStatic =
                Mockito.mockStatic(SecurityContextHolder.class)) {
            SecurityContext securityContext = mock(SecurityContext.class);
            mockedStatic.when(SecurityContextHolder::getContext).thenReturn(securityContext);
            when(securityContext.getAuthentication()).thenReturn(null);

            assertThatThrownBy(() -> accessGuard.currentUser())
                    .isInstanceOf(IllegalStateException.class);
        }
    }

    @Test
    public void currentUser_throwsWhenAuthenticationNameIsNull() {
        try (MockedStatic<SecurityContextHolder> mockedStatic =
                Mockito.mockStatic(SecurityContextHolder.class)) {
            SecurityContext securityContext = mock(SecurityContext.class);
            Authentication authentication = mock(Authentication.class);
            mockedStatic.when(SecurityContextHolder::getContext).thenReturn(securityContext);
            when(securityContext.getAuthentication()).thenReturn(authentication);
            when(authentication.getName()).thenReturn(null);

            assertThatThrownBy(() -> accessGuard.currentUser())
                    .isInstanceOf(IllegalStateException.class);
        }
    }

    @Test
    public void currentUser_throwsWhenUserNotFoundByEmail() {
        try (MockedStatic<SecurityContextHolder> mockedStatic =
                Mockito.mockStatic(SecurityContextHolder.class)) {
            SecurityContext securityContext = mock(SecurityContext.class);
            Authentication authentication = mock(Authentication.class);
            mockedStatic.when(SecurityContextHolder::getContext).thenReturn(securityContext);
            when(securityContext.getAuthentication()).thenReturn(authentication);
            when(authentication.getName()).thenReturn("user@example.com");
            when(userService.findByEmail("user@example.com")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> accessGuard.currentUser())
                    .isInstanceOf(IllegalStateException.class);
        }
    }

    @Test
    public void currentUser_returnsUserFromUserServiceWhenFound() {
        try (MockedStatic<SecurityContextHolder> mockedStatic =
                Mockito.mockStatic(SecurityContextHolder.class)) {
            SecurityContext securityContext = mock(SecurityContext.class);
            Authentication authentication = mock(Authentication.class);
            User user = new User();
            user.setId(1L);
            user.setEmail("user@example.com");

            mockedStatic.when(SecurityContextHolder::getContext).thenReturn(securityContext);
            when(securityContext.getAuthentication()).thenReturn(authentication);
            when(authentication.getName()).thenReturn("user@example.com");
            when(userService.findByEmail("user@example.com")).thenReturn(Optional.of(user));

            User result = accessGuard.currentUser();

            assertThat(result).isSameAs(user);
        }
    }

    // isAdmin

    @Test
    public void isAdmin_trueWhenRoleIsAdmin() {
        User user = new User();
        user.setRole("ROLE_ADMIN");
        assertThat(accessGuard.isAdmin(user)).isTrue();
    }

    @Test
    public void isAdmin_falseWhenRoleIsNotAdmin() {
        User user = new User();
        user.setRole("ROLE_PROCESSOR");
        assertThat(accessGuard.isAdmin(user)).isFalse();
    }

    @Test
    public void isAdmin_falseWhenUserIsNull() {
        assertThat(accessGuard.isAdmin(null)).isFalse();
    }

    // isProcessorRole

    @Test
    public void isProcessorRole_trueWhenRoleIsProcessor() {
        User user = new User();
        user.setRole("ROLE_PROCESSOR");
        assertThat(accessGuard.isProcessorRole(user)).isTrue();
    }

    @Test
    public void isProcessorRole_falseWhenRoleIsNotProcessor() {
        User user = new User();
        user.setRole("ROLE_ADMIN");
        assertThat(accessGuard.isProcessorRole(user)).isFalse();
    }

    @Test
    public void isProcessorRole_falseWhenUserIsNull() {
        assertThat(accessGuard.isProcessorRole(null)).isFalse();
    }

    // isUnderwriterRole

    @Test
    public void isUnderwriterRole_trueWhenRoleIsUnderwriter() {
        User user = new User();
        user.setRole("ROLE_UNDERWRITER");
        assertThat(accessGuard.isUnderwriterRole(user)).isTrue();
    }

    @Test
    public void isUnderwriterRole_falseWhenRoleIsNotUnderwriter() {
        User user = new User();
        user.setRole("ROLE_ADMIN");
        assertThat(accessGuard.isUnderwriterRole(user)).isFalse();
    }

    @Test
    public void isUnderwriterRole_falseWhenUserIsNull() {
        assertThat(accessGuard.isUnderwriterRole(null)).isFalse();
    }

    // isOwningApplicant

    @Test
    public void isOwningApplicant_trueWhenApplicantIdMatches() {
        User applicant = new User();
        applicant.setId(5L);
        LoanApplication app = new LoanApplication();
        app.setApplicant(applicant);

        User user = new User();
        user.setId(5L);

        assertThat(accessGuard.isOwningApplicant(app, user)).isTrue();
    }

    @Test
    public void isOwningApplicant_falseWhenApplicantIdDoesNotMatch() {
        User applicant = new User();
        applicant.setId(5L);
        LoanApplication app = new LoanApplication();
        app.setApplicant(applicant);

        User user = new User();
        user.setId(6L);

        assertThat(accessGuard.isOwningApplicant(app, user)).isFalse();
    }

    @Test
    public void isOwningApplicant_falseWhenAppIsNull() {
        User user = new User();
        user.setId(5L);
        assertThat(accessGuard.isOwningApplicant(null, user)).isFalse();
    }

    @Test
    public void isOwningApplicant_falseWhenUserIsNull() {
        LoanApplication app = new LoanApplication();
        assertThat(accessGuard.isOwningApplicant(app, null)).isFalse();
    }

    @Test
    public void isOwningApplicant_falseWhenApplicantFieldIsNull() {
        LoanApplication app = new LoanApplication();
        User user = new User();
        user.setId(5L);
        assertThat(accessGuard.isOwningApplicant(app, user)).isFalse();
    }

    // isAssignedProcessor

    @Test
    public void isAssignedProcessor_trueWhenProcessorIdMatches() {
        User processor = new User();
        processor.setId(7L);
        LoanApplication app = new LoanApplication();
        app.setProcessor(processor);

        User user = new User();
        user.setId(7L);

        assertThat(accessGuard.isAssignedProcessor(app, user)).isTrue();
    }

    @Test
    public void isAssignedProcessor_falseWhenProcessorIdDoesNotMatch() {
        User processor = new User();
        processor.setId(7L);
        LoanApplication app = new LoanApplication();
        app.setProcessor(processor);

        User user = new User();
        user.setId(8L);

        assertThat(accessGuard.isAssignedProcessor(app, user)).isFalse();
    }

    @Test
    public void isAssignedProcessor_falseWhenAppIsNull() {
        User user = new User();
        user.setId(7L);
        assertThat(accessGuard.isAssignedProcessor(null, user)).isFalse();
    }

    @Test
    public void isAssignedProcessor_falseWhenUserIsNull() {
        LoanApplication app = new LoanApplication();
        assertThat(accessGuard.isAssignedProcessor(app, null)).isFalse();
    }

    @Test
    public void isAssignedProcessor_falseWhenProcessorFieldIsNull() {
        LoanApplication app = new LoanApplication();
        User user = new User();
        user.setId(7L);
        assertThat(accessGuard.isAssignedProcessor(app, user)).isFalse();
    }

    // isAssignedUnderwriter

    @Test
    public void isAssignedUnderwriter_trueWhenUnderwriterIdMatches() {
        User underwriter = new User();
        underwriter.setId(9L);
        LoanApplication app = new LoanApplication();
        app.setUnderwriter(underwriter);

        User user = new User();
        user.setId(9L);

        assertThat(accessGuard.isAssignedUnderwriter(app, user)).isTrue();
    }

    @Test
    public void isAssignedUnderwriter_falseWhenUnderwriterIdDoesNotMatch() {
        User underwriter = new User();
        underwriter.setId(9L);
        LoanApplication app = new LoanApplication();
        app.setUnderwriter(underwriter);

        User user = new User();
        user.setId(10L);

        assertThat(accessGuard.isAssignedUnderwriter(app, user)).isFalse();
    }

    @Test
    public void isAssignedUnderwriter_falseWhenAppIsNull() {
        User user = new User();
        user.setId(9L);
        assertThat(accessGuard.isAssignedUnderwriter(null, user)).isFalse();
    }

    @Test
    public void isAssignedUnderwriter_falseWhenUserIsNull() {
        LoanApplication app = new LoanApplication();
        assertThat(accessGuard.isAssignedUnderwriter(app, null)).isFalse();
    }

    @Test
    public void isAssignedUnderwriter_falseWhenUnderwriterFieldIsNull() {
        LoanApplication app = new LoanApplication();
        User user = new User();
        user.setId(9L);
        assertThat(accessGuard.isAssignedUnderwriter(app, user)).isFalse();
    }

    // hasAccess

    @Test
    public void hasAccess_trueForAdminRegardlessOfOwnership() {
        User admin = new User();
        admin.setId(100L);
        admin.setRole("ROLE_ADMIN");

        LoanApplication app = new LoanApplication();
        // no applicant/processor/underwriter set - admin should still have access

        assertThat(accessGuard.hasAccess(app, admin)).isTrue();
    }

    @Test
    public void hasAccess_trueForOwningApplicant() {
        User applicant = new User();
        applicant.setId(1L);
        applicant.setRole("ROLE_APPLICANT");
        LoanApplication app = new LoanApplication();
        app.setApplicant(applicant);

        assertThat(accessGuard.hasAccess(app, applicant)).isTrue();
    }

    @Test
    public void hasAccess_trueForAssignedProcessor() {
        User processor = new User();
        processor.setId(2L);
        processor.setRole("ROLE_PROCESSOR");
        LoanApplication app = new LoanApplication();
        app.setProcessor(processor);

        assertThat(accessGuard.hasAccess(app, processor)).isTrue();
    }

    @Test
    public void hasAccess_trueForAssignedUnderwriter() {
        User underwriter = new User();
        underwriter.setId(3L);
        underwriter.setRole("ROLE_UNDERWRITER");
        LoanApplication app = new LoanApplication();
        app.setUnderwriter(underwriter);

        assertThat(accessGuard.hasAccess(app, underwriter)).isTrue();
    }

    @Test
    public void hasAccess_falseWhenNoneApply() {
        User applicant = new User();
        applicant.setId(1L);
        User processor = new User();
        processor.setId(2L);
        User underwriter = new User();
        underwriter.setId(3L);

        LoanApplication app = new LoanApplication();
        app.setApplicant(applicant);
        app.setProcessor(processor);
        app.setUnderwriter(underwriter);

        User outsider = new User();
        outsider.setId(999L);
        outsider.setRole("ROLE_APPLICANT");

        assertThat(accessGuard.hasAccess(app, outsider)).isFalse();
    }
}
