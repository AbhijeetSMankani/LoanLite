package com.loanlite.loanlite.services;

import com.loanlite.loanlite.entities.LoanApplication;
import com.loanlite.loanlite.repository.LoanApplicationRepository;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class LoanApplicationServiceTest {

    @Mock
    private LoanApplicationRepository loanApplicationRepository;

    @InjectMocks
    private LoanApplicationService service;

    @Nested
    class CalculateEmiTests {

        @Test
        void calculateEmi_validInputs_returnsExpectedEmi() {
            BigDecimal principal = new BigDecimal("100000");
            int tenureMonths = 12;
            BigDecimal annualRate = new BigDecimal("12.00");

            BigDecimal monthlyRate = annualRate.divide(new BigDecimal("1200"), java.math.MathContext.DECIMAL64);
            BigDecimal compounded = BigDecimal.ONE.add(monthlyRate).pow(tenureMonths, java.math.MathContext.DECIMAL64);
            BigDecimal denominator = compounded.subtract(BigDecimal.ONE);
            BigDecimal numerator = principal.multiply(monthlyRate).multiply(compounded);
            BigDecimal expected = numerator.divide(denominator, 2, RoundingMode.HALF_UP);

            BigDecimal emi = LoanApplicationService.calculateEmi(principal, tenureMonths, annualRate);

            assertThat(emi).isNotNull();
            assertThat(emi).isEqualByComparingTo(expected);
            assertThat(emi.compareTo(BigDecimal.ZERO)).isGreaterThan(0);
        }

        @Test
        void calculateEmi_nullPrincipal_returnsNull() {
            assertThat(LoanApplicationService.calculateEmi(null, 12, new BigDecimal("12.00"))).isNull();
        }

        @Test
        void calculateEmi_nullTenureMonths_returnsNull() {
            assertThat(LoanApplicationService.calculateEmi(new BigDecimal("100000"), null, new BigDecimal("12.00"))).isNull();
        }

        @Test
        void calculateEmi_zeroTenureMonths_returnsNull() {
            assertThat(LoanApplicationService.calculateEmi(new BigDecimal("100000"), 0, new BigDecimal("12.00"))).isNull();
        }

        @Test
        void calculateEmi_nullAnnualRate_returnsNull() {
            assertThat(LoanApplicationService.calculateEmi(new BigDecimal("100000"), 12, null)).isNull();
        }
    }

    @Test
    void createApplication_throwsWhenApplicationNumberAlreadyExists() {
        LoanApplication app = new LoanApplication();
        app.setApplicationNumber("APP-1");

        when(loanApplicationRepository.findByApplicationNumber("APP-1")).thenReturn(Optional.of(new LoanApplication()));

        assertThatThrownBy(() -> service.createApplication(app)).isInstanceOf(RuntimeException.class);
    }

    @Test
    void createApplication_happyPath_setsEmiAndTimestamps() {
        LoanApplication app = new LoanApplication();
        app.setApplicationNumber(null);
        app.setLoanAmount(new BigDecimal("100000"));
        app.setTenureMonths(12);
        app.setInterestRate(new BigDecimal("12.00"));

        when(loanApplicationRepository.save(any(LoanApplication.class))).thenAnswer(inv -> inv.getArgument(0));

        LoanApplication result = service.createApplication(app);

        ArgumentCaptor<LoanApplication> captor = ArgumentCaptor.forClass(LoanApplication.class);
        verify(loanApplicationRepository).save(captor.capture());
        LoanApplication saved = captor.getValue();

        assertThat(saved.getEmi()).isNotNull();
        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.getUpdatedAt()).isNotNull();
        assertThat(result).isSameAs(saved);
    }

    @Test
    void getApplication_found_returnsEntity() {
        LoanApplication app = new LoanApplication();
        app.setId(1L);
        when(loanApplicationRepository.findById(1L)).thenReturn(Optional.of(app));

        LoanApplication result = service.getApplication(1L);

        assertThat(result).isSameAs(app);
    }

    @Test
    void getApplication_notFound_throws() {
        when(loanApplicationRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getApplication(99L)).isInstanceOf(RuntimeException.class);
    }

    @Test
    void findByApplicationNumber_delegatesToRepository() {
        LoanApplication app = new LoanApplication();
        when(loanApplicationRepository.findByApplicationNumber("APP-1")).thenReturn(Optional.of(app));

        Optional<LoanApplication> result = service.findByApplicationNumber("APP-1");

        assertThat(result).contains(app);
        verify(loanApplicationRepository).findByApplicationNumber("APP-1");
    }

    @Test
    void findByApplicantId_delegatesToRepository() {
        List<LoanApplication> list = Collections.singletonList(new LoanApplication());
        when(loanApplicationRepository.findByApplicantId(5L)).thenReturn(list);

        List<LoanApplication> result = service.findByApplicantId(5L);

        assertThat(result).isSameAs(list);
        verify(loanApplicationRepository).findByApplicantId(5L);
    }

    @Test
    void findByStatus_delegatesToRepository() {
        Pageable pageable = mock(Pageable.class);
        Page<LoanApplication> page = new PageImpl<>(Collections.emptyList());
        when(loanApplicationRepository.findByStatus("Submitted", pageable)).thenReturn(page);

        Page<LoanApplication> result = service.findByStatus("Submitted", pageable);

        assertThat(result).isSameAs(page);
        verify(loanApplicationRepository).findByStatus("Submitted", pageable);
    }

    @Test
    void findByProcessorId_delegatesToRepository() {
        List<LoanApplication> list = Collections.singletonList(new LoanApplication());
        when(loanApplicationRepository.findByProcessorId(7L)).thenReturn(list);

        List<LoanApplication> result = service.findByProcessorId(7L);

        assertThat(result).isSameAs(list);
        verify(loanApplicationRepository).findByProcessorId(7L);
    }

    @Test
    void findByUnderwriterId_delegatesToRepository() {
        List<LoanApplication> list = Collections.singletonList(new LoanApplication());
        when(loanApplicationRepository.findByUnderwriterId(8L)).thenReturn(list);

        List<LoanApplication> result = service.findByUnderwriterId(8L);

        assertThat(result).isSameAs(list);
        verify(loanApplicationRepository).findByUnderwriterId(8L);
    }

    @Test
    void updateApplication_notFound_throws() {
        when(loanApplicationRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateApplication(1L, new LoanApplication()))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void updateApplication_applicationNumberCollisionWithDifferentApp_throws() {
        LoanApplication existing = new LoanApplication();
        existing.setId(1L);
        existing.setApplicationNumber("OLD-NUM");

        LoanApplication update = new LoanApplication();
        update.setApplicationNumber("NEW-NUM");

        LoanApplication otherApp = new LoanApplication();
        otherApp.setId(2L);

        when(loanApplicationRepository.findById(1L)).thenReturn(Optional.of(existing));
        when(loanApplicationRepository.findByApplicationNumber("NEW-NUM")).thenReturn(Optional.of(otherApp));

        assertThatThrownBy(() -> service.updateApplication(1L, update)).isInstanceOf(RuntimeException.class);
    }

    @Test
    void updateApplication_partialUpdate_leavesOtherFieldsUntouchedAndRecomputesEmi() {
        LoanApplication existing = new LoanApplication();
        existing.setId(1L);
        existing.setApplicationNumber("APP-1");
        existing.setLoanAmount(new BigDecimal("100000"));
        existing.setTenureMonths(12);
        existing.setInterestRate(new BigDecimal("12.00"));
        existing.setDeclaredIncome(new BigDecimal("50000"));
        existing.setStatus("Submitted");

        LoanApplication update = new LoanApplication();
        update.setTenureMonths(24);

        when(loanApplicationRepository.findById(1L)).thenReturn(Optional.of(existing));
        when(loanApplicationRepository.save(any(LoanApplication.class))).thenAnswer(inv -> inv.getArgument(0));

        LoanApplication result = service.updateApplication(1L, update);

        ArgumentCaptor<LoanApplication> captor = ArgumentCaptor.forClass(LoanApplication.class);
        verify(loanApplicationRepository).save(captor.capture());
        LoanApplication saved = captor.getValue();

        assertThat(saved.getApplicationNumber()).isEqualTo("APP-1");
        assertThat(saved.getDeclaredIncome()).isEqualByComparingTo(new BigDecimal("50000"));
        assertThat(saved.getStatus()).isEqualTo("Submitted");
        assertThat(saved.getTenureMonths()).isEqualTo(24);
        assertThat(saved.getEmi()).isEqualByComparingTo(
                LoanApplicationService.calculateEmi(new BigDecimal("100000"), 24, new BigDecimal("12.00")));
        assertThat(saved.getUpdatedAt()).isNotNull();
        assertThat(result).isSameAs(saved);
    }

    @Test
    void claimForProcessor_zeroRowsUpdated_returnsEmpty() {
        when(loanApplicationRepository.claimForProcessor(eq(1L), eq("Submitted"), eq("In Progress"), eq(5L), any(LocalDateTime.class)))
                .thenReturn(0);

        Optional<LoanApplication> result = service.claimForProcessor(1L, "Submitted", "In Progress", 5L);

        assertThat(result).isEmpty();
    }

    @Test
    void claimForProcessor_oneRowUpdated_returnsFreshlyFetchedEntity() {
        LoanApplication app = new LoanApplication();
        app.setId(1L);

        when(loanApplicationRepository.claimForProcessor(eq(1L), eq("Submitted"), eq("In Progress"), eq(5L), any(LocalDateTime.class)))
                .thenReturn(1);
        when(loanApplicationRepository.findById(1L)).thenReturn(Optional.of(app));

        Optional<LoanApplication> result = service.claimForProcessor(1L, "Submitted", "In Progress", 5L);

        assertThat(result).contains(app);
        verify(loanApplicationRepository).findById(1L);
    }

    @Test
    void claimForUnderwriter_zeroRowsUpdated_returnsEmpty() {
        when(loanApplicationRepository.claimForUnderwriter(eq(1L), eq("Processed"), eq("Under Review"), eq(9L), any(LocalDateTime.class)))
                .thenReturn(0);

        Optional<LoanApplication> result = service.claimForUnderwriter(1L, "Processed", "Under Review", 9L);

        assertThat(result).isEmpty();
    }

    @Test
    void claimForUnderwriter_oneRowUpdated_returnsFreshlyFetchedEntity() {
        LoanApplication app = new LoanApplication();
        app.setId(1L);

        when(loanApplicationRepository.claimForUnderwriter(eq(1L), eq("Processed"), eq("Under Review"), eq(9L), any(LocalDateTime.class)))
                .thenReturn(1);
        when(loanApplicationRepository.findById(1L)).thenReturn(Optional.of(app));

        Optional<LoanApplication> result = service.claimForUnderwriter(1L, "Processed", "Under Review", 9L);

        assertThat(result).contains(app);
        verify(loanApplicationRepository).findById(1L);
    }

    @Test
    void deleteApplication_notFound_throws() {
        when(loanApplicationRepository.existsById(1L)).thenReturn(false);

        assertThatThrownBy(() -> service.deleteApplication(1L)).isInstanceOf(RuntimeException.class);
    }

    @Test
    void deleteApplication_found_deletesById() {
        when(loanApplicationRepository.existsById(1L)).thenReturn(true);

        service.deleteApplication(1L);

        verify(loanApplicationRepository).deleteById(1L);
    }

    @Test
    void getStats_withGroupedRows_computesTotalsAndBreakdown() {
        List<Object[]> rows = Arrays.asList(
                new Object[]{"Submitted", 3L},
                new Object[]{"Accepted", 2L}
        );
        when(loanApplicationRepository.countGroupedByStatus()).thenReturn(rows);
        when(loanApplicationRepository.countByCreatedAtGreaterThanEqual(any(LocalDateTime.class))).thenReturn(4L);
        when(loanApplicationRepository.countByStatusAndUpdatedAtGreaterThanEqual(eq("Accepted"), any(LocalDateTime.class))).thenReturn(2L);
        when(loanApplicationRepository.countByStatusAndUpdatedAtGreaterThanEqual(eq("Rejected"), any(LocalDateTime.class))).thenReturn(1L);

        Map<String, Object> stats = service.getStats();

        assertThat(stats.get("totalApplications")).isEqualTo(5L);
        assertThat(stats.get("byStatus")).isEqualTo(Map.of("Submitted", 3L, "Accepted", 2L));
        assertThat(stats.get("createdThisMonth")).isEqualTo(4L);
        assertThat(stats.get("approvedThisMonth")).isEqualTo(2L);
        assertThat(stats.get("rejectedThisMonth")).isEqualTo(1L);
    }

    @Test
    void getStats_withEmptyGroups_returnsZeroTotalsAndEmptyMap() {
        when(loanApplicationRepository.countGroupedByStatus()).thenReturn(new ArrayList<>());
        when(loanApplicationRepository.countByCreatedAtGreaterThanEqual(any(LocalDateTime.class))).thenReturn(0L);
        when(loanApplicationRepository.countByStatusAndUpdatedAtGreaterThanEqual(eq("Accepted"), any(LocalDateTime.class))).thenReturn(0L);
        when(loanApplicationRepository.countByStatusAndUpdatedAtGreaterThanEqual(eq("Rejected"), any(LocalDateTime.class))).thenReturn(0L);

        Map<String, Object> stats = service.getStats();

        assertThat(stats.get("totalApplications")).isEqualTo(0L);
        assertThat((Map<?, ?>) stats.get("byStatus")).isEmpty();
        assertThat(stats.get("createdThisMonth")).isEqualTo(0L);
        assertThat(stats.get("approvedThisMonth")).isEqualTo(0L);
        assertThat(stats.get("rejectedThisMonth")).isEqualTo(0L);
    }

    @Test
    void search_delegatesToRepositoryFindAllWithSpecification() {
        Pageable pageable = mock(Pageable.class);
        Page<LoanApplication> page = new PageImpl<>(Collections.emptyList());
        when(loanApplicationRepository.findAll(any(Specification.class), eq(pageable))).thenReturn(page);

        Page<LoanApplication> result = service.search("Submitted", 1L, 2L, 3L, pageable);

        assertThat(result).isSameAs(page);
        verify(loanApplicationRepository).findAll(any(Specification.class), eq(pageable));
    }
}
