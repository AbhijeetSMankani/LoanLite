package com.loanlite.loanlite.security.jwt;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class JwtAuthenticationFilterTest {

    @Mock
    private JwtUtil jwtUtil;

    @Mock
    private UserDetailsService userDetailsService;

    @Mock
    private HttpServletRequest request;

    @Mock
    private HttpServletResponse response;

    @Mock
    private FilterChain filterChain;

    @InjectMocks
    private JwtAuthenticationFilter filter;

    @BeforeEach
    public void clearContextBefore() {
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    public void clearContextAfter() {
        SecurityContextHolder.clearContext();
    }

    @Test
    public void doFilterInternal_noAuthorizationHeader_leavesContextUnauthenticatedAndCallsChain() throws Exception {
        when(request.getHeader("Authorization")).thenReturn(null);

        filter.doFilterInternal(request, response, filterChain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(filterChain, times(1)).doFilter(request, response);
    }

    @Test
    public void doFilterInternal_headerDoesNotStartWithBearer_leavesContextUnauthenticatedAndCallsChain() throws Exception {
        when(request.getHeader("Authorization")).thenReturn("Basic abc123");

        filter.doFilterInternal(request, response, filterChain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(filterChain, times(1)).doFilter(request, response);
    }

    @Test
    public void doFilterInternal_extractUsernameThrows_leavesContextUnauthenticatedAndCallsChain() throws Exception {
        when(request.getHeader("Authorization")).thenReturn("Bearer bad-token");
        when(jwtUtil.extractUsername("bad-token")).thenThrow(new RuntimeException("invalid token"));

        filter.doFilterInternal(request, response, filterChain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(jwtUtil, times(1)).extractUsername("bad-token");
        verify(userDetailsService, never()).loadUserByUsername(any());
        verify(filterChain, times(1)).doFilter(request, response);
    }

    @Test
    public void doFilterInternal_validTokenAndValidation_setsAuthenticationInContext() throws Exception {
        UserDetails userDetails = User.withUsername("user@example.com")
                .password("ignored")
                .authorities("ROLE_USER")
                .build();

        when(request.getHeader("Authorization")).thenReturn("Bearer good-token");
        when(jwtUtil.extractUsername("good-token")).thenReturn("user@example.com");
        when(userDetailsService.loadUserByUsername("user@example.com")).thenReturn(userDetails);
        when(jwtUtil.validateToken("good-token", userDetails)).thenReturn(true);

        filter.doFilterInternal(request, response, filterChain);

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        assertThat(authentication).isNotNull();
        assertThat(authentication.getPrincipal()).isSameAs(userDetails);
        verify(filterChain, times(1)).doFilter(request, response);
    }

    @Test
    public void doFilterInternal_validateTokenReturnsFalse_leavesContextUnauthenticated() throws Exception {
        UserDetails userDetails = User.withUsername("user@example.com")
                .password("ignored")
                .authorities("ROLE_USER")
                .build();

        when(request.getHeader("Authorization")).thenReturn("Bearer good-token");
        when(jwtUtil.extractUsername("good-token")).thenReturn("user@example.com");
        when(userDetailsService.loadUserByUsername("user@example.com")).thenReturn(userDetails);
        when(jwtUtil.validateToken("good-token", userDetails)).thenReturn(false);

        filter.doFilterInternal(request, response, filterChain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(filterChain, times(1)).doFilter(request, response);
    }

    @Test
    public void doFilterInternal_preExistingAuthentication_isNotOverwritten() throws Exception {
        UsernamePasswordAuthenticationToken existingAuth =
                new UsernamePasswordAuthenticationToken("existing-user", null);
        SecurityContextHolder.getContext().setAuthentication(existingAuth);

        when(request.getHeader("Authorization")).thenReturn("Bearer good-token");
        when(jwtUtil.extractUsername("good-token")).thenReturn("user@example.com");

        filter.doFilterInternal(request, response, filterChain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isSameAs(existingAuth);
        verify(userDetailsService, never()).loadUserByUsername(any());
        verify(filterChain, times(1)).doFilter(request, response);
    }
}
