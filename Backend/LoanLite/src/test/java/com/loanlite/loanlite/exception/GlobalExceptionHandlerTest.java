package com.loanlite.loanlite.exception;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class GlobalExceptionHandlerTest {

    @Mock
    private WebRequest webRequest;

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @BeforeEach
    public void setUp() {
        when(webRequest.getDescription(false)).thenReturn("uri=/api/test");
    }

    @Test
    public void handleApiExceptionReturnsExceptionStatusAndMessage() {
        ResponseEntity<Map<String, Object>> response =
                handler.handleApiException(ApiException.forbidden("no access"), webRequest);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("message")).isEqualTo("no access");
        assertThat(response.getBody().get("status")).isEqualTo(HttpStatus.FORBIDDEN.value());
        assertThat(response.getBody().get("error")).isEqualTo(HttpStatus.FORBIDDEN.getReasonPhrase());
    }

    @Test
    public void handleValidationJoinsFieldErrorsAndReturnsBadRequest() {
        MethodParameter methodParameter = org.mockito.Mockito.mock(MethodParameter.class);
        BindingResult bindingResult = org.mockito.Mockito.mock(BindingResult.class);
        when(bindingResult.getFieldErrors()).thenReturn(
                List.of(new FieldError("objectName", "loanAmount", "must be at least 50000")));

        MethodArgumentNotValidException ex =
                new MethodArgumentNotValidException(methodParameter, bindingResult);

        ResponseEntity<Map<String, Object>> response = handler.handleValidation(ex, webRequest);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("message")).isEqualTo("loanAmount: must be at least 50000");
    }

    @Test
    public void handleAccessDeniedReturnsForbidden() {
        ResponseEntity<Map<String, Object>> response =
                handler.handleAccessDenied(new AccessDeniedException("denied"), webRequest);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("message")).isEqualTo("denied");
    }

    @Test
    public void handleAuthenticationReturnsUnauthorized() {
        ResponseEntity<Map<String, Object>> response =
                handler.handleAuthentication(new BadCredentialsException("bad creds"), webRequest);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("message")).isEqualTo("bad creds");
    }

    @Test
    public void handleBadRequestReturnsBadRequest() {
        ResponseEntity<Map<String, Object>> response =
                handler.handleBadRequest(new IllegalArgumentException("bad input"), webRequest);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("message")).isEqualTo("bad input");
    }

    @Test
    public void handleIllegalStateReturnsNotFound() {
        ResponseEntity<Map<String, Object>> response =
                handler.handleIllegalState(new IllegalStateException("state problem"), webRequest);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("message")).isEqualTo("state problem");
    }

    @Test
    public void handleMaxUploadSizeReturnsGenericBadRequestMessage() {
        MaxUploadSizeExceededException ex = new MaxUploadSizeExceededException(1024L);

        ResponseEntity<Map<String, Object>> response = handler.handleMaxUploadSize(ex, webRequest);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("message")).isEqualTo("Uploaded file exceeds the maximum allowed size.");
    }

    @Test
    public void handleRuntimeWithNotFoundMessageReturnsNotFound() {
        ResponseEntity<Map<String, Object>> response =
                handler.handleRuntime(new RuntimeException("Loan application not found with id: 5"), webRequest);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("message")).isEqualTo("Loan application not found with id: 5");
    }

    @Test
    public void handleRuntimeWithOtherMessageReturnsGenericServerError() {
        ResponseEntity<Map<String, Object>> response =
                handler.handleRuntime(new RuntimeException("something else broke"), webRequest);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("message")).isEqualTo("An unexpected error occurred.");
    }

    @Test
    public void handleAnyReturnsGenericServerError() {
        ResponseEntity<Map<String, Object>> response =
                handler.handleAny(new Exception("weird failure"), webRequest);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("message")).isEqualTo("An unexpected error occurred.");
    }
}
