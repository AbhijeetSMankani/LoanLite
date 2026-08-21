package com.loanlite.loanlite.security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import com.loanlite.loanlite.entities.LoanApplication;
import com.loanlite.loanlite.entities.User;
import com.loanlite.loanlite.services.UserService;

// Resolves the currently authenticated User and checks whether they may act on
// a given LoanApplication: as the owning applicant, the assigned processor,
// the assigned underwriter, or an admin (who can always access everything).
@Component
public class LoanApplicationAccessGuard {

    @Autowired
    private UserService userService;

    public User currentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            throw new IllegalStateException("No authenticated user in the current security context");
        }
        return userService.findByEmail(authentication.getName())
                .orElseThrow(() -> new IllegalStateException("Authenticated user not found for email: " + authentication.getName()));
    }

    public boolean isAdmin(User user) {
        return user != null && "ROLE_ADMIN".equals(user.getRole());
    }

    public boolean isProcessorRole(User user) {
        return user != null && "ROLE_PROCESSOR".equals(user.getRole());
    }

    public boolean isUnderwriterRole(User user) {
        return user != null && "ROLE_UNDERWRITER".equals(user.getRole());
    }

    public boolean isOwningApplicant(LoanApplication app, User user) {
        return app != null && user != null
                && app.getApplicant() != null
                && app.getApplicant().getId().equals(user.getId());
    }

    public boolean isAssignedProcessor(LoanApplication app, User user) {
        return app != null && user != null
                && app.getProcessor() != null
                && app.getProcessor().getId().equals(user.getId());
    }

    public boolean isAssignedUnderwriter(LoanApplication app, User user) {
        return app != null && user != null
                && app.getUnderwriter() != null
                && app.getUnderwriter().getId().equals(user.getId());
    }

    public boolean hasAccess(LoanApplication app, User user) {
        return isAdmin(user)
                || isOwningApplicant(app, user)
                || isAssignedProcessor(app, user)
                || isAssignedUnderwriter(app, user);
    }
}
