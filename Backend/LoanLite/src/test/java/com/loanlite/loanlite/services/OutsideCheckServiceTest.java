package com.loanlite.loanlite.services;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

public class OutsideCheckServiceTest {

    private OutsideCheckService newServiceWithMockRestTemplate(RestTemplate mockRestTemplate) {
        OutsideCheckService service = new OutsideCheckService();
        ReflectionTestUtils.setField(service, "restTemplate", mockRestTemplate);
        return service;
    }

    @Test
    void fetchCreditScore_validNumericResponse_returnsParsedInteger() {
        RestTemplate mockRestTemplate = mock(RestTemplate.class);
        when(mockRestTemplate.getForObject(anyString(), eq(String.class))).thenReturn("742");
        OutsideCheckService service = newServiceWithMockRestTemplate(mockRestTemplate);

        Integer result = service.fetchCreditScore();

        assertThat(result).isEqualTo(742);
    }

    @Test
    void fetchVerifiedIncome_validNumericResponse_returnsParsedInteger() {
        RestTemplate mockRestTemplate = mock(RestTemplate.class);
        when(mockRestTemplate.getForObject(anyString(), eq(String.class))).thenReturn("55000");
        OutsideCheckService service = newServiceWithMockRestTemplate(mockRestTemplate);

        Integer result = service.fetchVerifiedIncome();

        assertThat(result).isEqualTo(55000);
    }

    @Test
    void fetchCreditScore_nullResponse_returnsNull() {
        RestTemplate mockRestTemplate = mock(RestTemplate.class);
        when(mockRestTemplate.getForObject(anyString(), eq(String.class))).thenReturn(null);
        OutsideCheckService service = newServiceWithMockRestTemplate(mockRestTemplate);

        Integer result = service.fetchCreditScore();

        assertThat(result).isNull();
    }

    @Test
    void fetchCreditScore_emptyResponse_returnsNull() {
        RestTemplate mockRestTemplate = mock(RestTemplate.class);
        when(mockRestTemplate.getForObject(anyString(), eq(String.class))).thenReturn("");
        OutsideCheckService service = newServiceWithMockRestTemplate(mockRestTemplate);

        Integer result = service.fetchCreditScore();

        assertThat(result).isNull();
    }

    @Test
    void fetchCreditScore_blankResponse_returnsNull() {
        RestTemplate mockRestTemplate = mock(RestTemplate.class);
        when(mockRestTemplate.getForObject(anyString(), eq(String.class))).thenReturn("   ");
        OutsideCheckService service = newServiceWithMockRestTemplate(mockRestTemplate);

        Integer result = service.fetchCreditScore();

        assertThat(result).isNull();
    }

    @Test
    void fetchCreditScore_nonNumericResponse_returnsNullWithoutThrowing() {
        RestTemplate mockRestTemplate = mock(RestTemplate.class);
        when(mockRestTemplate.getForObject(anyString(), eq(String.class))).thenReturn("Error: quota exceeded");
        OutsideCheckService service = newServiceWithMockRestTemplate(mockRestTemplate);

        Integer result = service.fetchCreditScore();

        assertThat(result).isNull();
    }

    @Test
    void fetchCreditScore_restClientException_returnsNullWithoutPropagating() {
        RestTemplate mockRestTemplate = mock(RestTemplate.class);
        when(mockRestTemplate.getForObject(anyString(), eq(String.class)))
                .thenThrow(new RestClientException("boom"));
        OutsideCheckService service = newServiceWithMockRestTemplate(mockRestTemplate);

        Integer result = service.fetchCreditScore();

        assertThat(result).isNull();
    }

    @Test
    void fetchVerifiedIncome_timeoutException_returnsNullWithoutPropagating() {
        RestTemplate mockRestTemplate = mock(RestTemplate.class);
        when(mockRestTemplate.getForObject(anyString(), eq(String.class)))
                .thenThrow(new ResourceAccessException("timeout"));
        OutsideCheckService service = newServiceWithMockRestTemplate(mockRestTemplate);

        Integer result = service.fetchVerifiedIncome();

        assertThat(result).isNull();
    }
}
