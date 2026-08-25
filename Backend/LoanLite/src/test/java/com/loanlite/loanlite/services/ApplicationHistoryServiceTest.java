package com.loanlite.loanlite.services;

import com.loanlite.loanlite.entities.ApplicationHistory;
import com.loanlite.loanlite.entities.LoanApplication;
import com.loanlite.loanlite.entities.User;
import com.loanlite.loanlite.repository.ApplicationHistoryRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class ApplicationHistoryServiceTest {

    @Mock
    private ApplicationHistoryRepository applicationHistoryRepository;

    @InjectMocks
    private ApplicationHistoryService applicationHistoryService;

    @Test
    void createHistory_noCreatedAt_defaultsToNow() {
        ApplicationHistory h = new ApplicationHistory();
        h.setCreatedAt(null);

        when(applicationHistoryRepository.save(any(ApplicationHistory.class))).thenAnswer(inv -> inv.getArgument(0));

        applicationHistoryService.createHistory(h);

        ArgumentCaptor<ApplicationHistory> captor = ArgumentCaptor.forClass(ApplicationHistory.class);
        verify(applicationHistoryRepository).save(captor.capture());
        assertThat(captor.getValue().getCreatedAt()).isNotNull();
    }

    @Test
    void createHistory_createdAtAlreadySet_untouched() {
        LocalDateTime fixedTime = LocalDateTime.of(2020, 1, 1, 0, 0);
        ApplicationHistory h = new ApplicationHistory();
        h.setCreatedAt(fixedTime);

        when(applicationHistoryRepository.save(any(ApplicationHistory.class))).thenAnswer(inv -> inv.getArgument(0));

        applicationHistoryService.createHistory(h);

        ArgumentCaptor<ApplicationHistory> captor = ArgumentCaptor.forClass(ApplicationHistory.class);
        verify(applicationHistoryRepository).save(captor.capture());
        assertThat(captor.getValue().getCreatedAt()).isEqualTo(fixedTime);
    }

    @Test
    void log_buildsEntryFromArgsAndStampsCreatedAt() {
        LoanApplication application = new LoanApplication();
        application.setId(1L);
        User user = new User();
        user.setId(2L);

        when(applicationHistoryRepository.save(any(ApplicationHistory.class))).thenAnswer(inv -> inv.getArgument(0));

        applicationHistoryService.log(application, user, "SUBMIT", "submitted application");

        ArgumentCaptor<ApplicationHistory> captor = ArgumentCaptor.forClass(ApplicationHistory.class);
        verify(applicationHistoryRepository).save(captor.capture());
        ApplicationHistory saved = captor.getValue();

        assertThat(saved.getApplication()).isSameAs(application);
        assertThat(saved.getUser()).isSameAs(user);
        assertThat(saved.getAction()).isEqualTo("SUBMIT");
        assertThat(saved.getDetails()).isEqualTo("submitted application");
        assertThat(saved.getCreatedAt()).isNotNull();
    }

    @Test
    void getHistory_found_returnsEntity() {
        ApplicationHistory h = new ApplicationHistory();
        h.setId(1L);
        when(applicationHistoryRepository.findById(1L)).thenReturn(Optional.of(h));

        ApplicationHistory result = applicationHistoryService.getHistory(1L);

        assertThat(result).isSameAs(h);
    }

    @Test
    void getHistory_notFound_throws() {
        when(applicationHistoryRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> applicationHistoryService.getHistory(1L)).isInstanceOf(RuntimeException.class);
    }

    @Test
    void listVisibleTo_delegatesToRepository() {
        Pageable pageable = mock(Pageable.class);
        Page<ApplicationHistory> page = new PageImpl<>(Collections.emptyList());
        when(applicationHistoryRepository.findVisibleTo(1L, false, pageable)).thenReturn(page);

        Page<ApplicationHistory> result = applicationHistoryService.listVisibleTo(1L, false, pageable);

        assertThat(result).isSameAs(page);
        verify(applicationHistoryRepository).findVisibleTo(1L, false, pageable);
    }

    @Test
    void findByApplicationId_delegatesToRepository() {
        List<ApplicationHistory> list = Collections.singletonList(new ApplicationHistory());
        when(applicationHistoryRepository.findByApplicationId(5L)).thenReturn(list);

        List<ApplicationHistory> result = applicationHistoryService.findByApplicationId(5L);

        assertThat(result).isSameAs(list);
        verify(applicationHistoryRepository).findByApplicationId(5L);
    }

    @Test
    void findByUserId_delegatesToRepository() {
        List<ApplicationHistory> list = Collections.singletonList(new ApplicationHistory());
        when(applicationHistoryRepository.findByUserId(7L)).thenReturn(list);

        List<ApplicationHistory> result = applicationHistoryService.findByUserId(7L);

        assertThat(result).isSameAs(list);
        verify(applicationHistoryRepository).findByUserId(7L);
    }

    @Test
    void findByAction_delegatesToRepository() {
        List<ApplicationHistory> list = Collections.singletonList(new ApplicationHistory());
        when(applicationHistoryRepository.findByAction("SUBMIT")).thenReturn(list);

        List<ApplicationHistory> result = applicationHistoryService.findByAction("SUBMIT");

        assertThat(result).isSameAs(list);
        verify(applicationHistoryRepository).findByAction("SUBMIT");
    }

    @Test
    void findByApplicationIdOrderByCreatedAtDesc_delegatesToRepository() {
        List<ApplicationHistory> list = Collections.singletonList(new ApplicationHistory());
        when(applicationHistoryRepository.findByApplicationIdOrderByCreatedAtDesc(5L)).thenReturn(list);

        List<ApplicationHistory> result = applicationHistoryService.findByApplicationIdOrderByCreatedAtDesc(5L);

        assertThat(result).isSameAs(list);
        verify(applicationHistoryRepository).findByApplicationIdOrderByCreatedAtDesc(5L);
    }

    @Test
    void updateHistory_notFound_throws() {
        when(applicationHistoryRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> applicationHistoryService.updateHistory(1L, new ApplicationHistory()))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void updateHistory_partialUpdate_onlyOverwritesNonNullFields() {
        ApplicationHistory existing = new ApplicationHistory();
        existing.setId(1L);
        existing.setAction("SUBMIT");
        existing.setDetails("original details");

        ApplicationHistory update = new ApplicationHistory();
        update.setDetails("updated details");

        when(applicationHistoryRepository.findById(1L)).thenReturn(Optional.of(existing));
        when(applicationHistoryRepository.save(any(ApplicationHistory.class))).thenAnswer(inv -> inv.getArgument(0));

        ApplicationHistory result = applicationHistoryService.updateHistory(1L, update);

        assertThat(result.getDetails()).isEqualTo("updated details");
        assertThat(result.getAction()).isEqualTo("SUBMIT");
    }

    @Test
    void deleteHistory_notFound_throws() {
        when(applicationHistoryRepository.existsById(1L)).thenReturn(false);

        assertThatThrownBy(() -> applicationHistoryService.deleteHistory(1L)).isInstanceOf(RuntimeException.class);
    }

    @Test
    void deleteHistory_found_deletesById() {
        when(applicationHistoryRepository.existsById(1L)).thenReturn(true);

        applicationHistoryService.deleteHistory(1L);

        verify(applicationHistoryRepository).deleteById(1L);
    }
}
