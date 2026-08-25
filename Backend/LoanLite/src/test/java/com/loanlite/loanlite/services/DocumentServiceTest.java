package com.loanlite.loanlite.services;

import com.loanlite.loanlite.entities.Document;
import com.loanlite.loanlite.repository.DocumentRepository;
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
public class DocumentServiceTest {

    @Mock
    private DocumentRepository documentRepository;

    @InjectMocks
    private DocumentService documentService;

    @Test
    void createDocument_noUploadedAt_defaultsToNow() {
        Document doc = new Document();
        doc.setUploadedAt(null);

        when(documentRepository.save(any(Document.class))).thenAnswer(inv -> inv.getArgument(0));

        documentService.createDocument(doc);

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(documentRepository).save(captor.capture());
        assertThat(captor.getValue().getUploadedAt()).isNotNull();
    }

    @Test
    void createDocument_uploadedAtAlreadySet_untouched() {
        LocalDateTime fixedTime = LocalDateTime.of(2020, 1, 1, 0, 0);
        Document doc = new Document();
        doc.setUploadedAt(fixedTime);

        when(documentRepository.save(any(Document.class))).thenAnswer(inv -> inv.getArgument(0));

        documentService.createDocument(doc);

        ArgumentCaptor<Document> captor = ArgumentCaptor.forClass(Document.class);
        verify(documentRepository).save(captor.capture());
        assertThat(captor.getValue().getUploadedAt()).isEqualTo(fixedTime);
    }

    @Test
    void getDocument_found_returnsEntity() {
        Document doc = new Document();
        doc.setId(1L);
        when(documentRepository.findById(1L)).thenReturn(Optional.of(doc));

        Document result = documentService.getDocument(1L);

        assertThat(result).isSameAs(doc);
    }

    @Test
    void getDocument_notFound_throws() {
        when(documentRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> documentService.getDocument(1L)).isInstanceOf(RuntimeException.class);
    }

    @Test
    void listVisibleTo_delegatesToRepository() {
        Pageable pageable = mock(Pageable.class);
        Page<Document> page = new PageImpl<>(Collections.emptyList());
        when(documentRepository.findVisibleTo(1L, false, pageable)).thenReturn(page);

        Page<Document> result = documentService.listVisibleTo(1L, false, pageable);

        assertThat(result).isSameAs(page);
        verify(documentRepository).findVisibleTo(1L, false, pageable);
    }

    @Test
    void findByApplicationId_delegatesToRepository() {
        List<Document> list = Collections.singletonList(new Document());
        when(documentRepository.findByApplicationId(5L)).thenReturn(list);

        List<Document> result = documentService.findByApplicationId(5L);

        assertThat(result).isSameAs(list);
        verify(documentRepository).findByApplicationId(5L);
    }

    @Test
    void findByApplicationIdOrderByUploadedAtDesc_delegatesToRepository() {
        List<Document> list = Collections.singletonList(new Document());
        when(documentRepository.findByApplicationIdOrderByUploadedAtDesc(5L)).thenReturn(list);

        List<Document> result = documentService.findByApplicationIdOrderByUploadedAtDesc(5L);

        assertThat(result).isSameAs(list);
        verify(documentRepository).findByApplicationIdOrderByUploadedAtDesc(5L);
    }

    @Test
    void findByDocumentType_delegatesToRepository() {
        List<Document> list = Collections.singletonList(new Document());
        when(documentRepository.findByDocumentType("PAN")).thenReturn(list);

        List<Document> result = documentService.findByDocumentType("PAN");

        assertThat(result).isSameAs(list);
        verify(documentRepository).findByDocumentType("PAN");
    }

    @Test
    void updateDocument_notFound_throws() {
        when(documentRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> documentService.updateDocument(1L, new Document())).isInstanceOf(RuntimeException.class);
    }

    @Test
    void updateDocument_partialUpdate_onlyOverwritesNonNullFields() {
        Document existing = new Document();
        existing.setId(1L);
        existing.setFileName("original.pdf");
        existing.setFilePath("/files/original.pdf");
        existing.setVerificationStatus("Pending");
        existing.setRemarks("none");

        Document update = new Document();
        update.setVerificationStatus("Verified");
        update.setRemarks("looks good");

        when(documentRepository.findById(1L)).thenReturn(Optional.of(existing));
        when(documentRepository.save(any(Document.class))).thenAnswer(inv -> inv.getArgument(0));

        Document result = documentService.updateDocument(1L, update);

        assertThat(result.getVerificationStatus()).isEqualTo("Verified");
        assertThat(result.getRemarks()).isEqualTo("looks good");
        assertThat(result.getFileName()).isEqualTo("original.pdf");
        assertThat(result.getFilePath()).isEqualTo("/files/original.pdf");
    }

    @Test
    void deleteDocument_notFound_throws() {
        when(documentRepository.existsById(1L)).thenReturn(false);

        assertThatThrownBy(() -> documentService.deleteDocument(1L)).isInstanceOf(RuntimeException.class);
    }

    @Test
    void deleteDocument_found_deletesById() {
        when(documentRepository.existsById(1L)).thenReturn(true);

        documentService.deleteDocument(1L);

        verify(documentRepository).deleteById(1L);
    }
}
