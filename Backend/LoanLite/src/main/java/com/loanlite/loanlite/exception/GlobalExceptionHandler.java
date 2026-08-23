package com.loanlite.loanlite.exception;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    // Access-denied (@PreAuthorize failures) and bad-credentials/authentication failures are
    // handled explicitly here so they keep their correct status codes instead of falling
    // through to the generic RuntimeException handler below.

    // Manual ownership/precondition checks in controllers throw this directly with an explicit
    // status instead of returning an empty-body ResponseEntity (backendTodo.csv task 3).
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, Object>> handleApiException(ApiException ex, WebRequest request) {
        return build(ex.getStatus(), ex, request);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(AccessDeniedException ex, WebRequest request) {
        return build(HttpStatus.FORBIDDEN, ex, request);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<Map<String, Object>> handleAuthentication(AuthenticationException ex, WebRequest request) {
        return build(HttpStatus.UNAUTHORIZED, ex, request);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleBadRequest(IllegalArgumentException ex, WebRequest request) {
        return build(HttpStatus.BAD_REQUEST, ex, request);
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalState(IllegalStateException ex, WebRequest request) {
        return build(HttpStatus.NOT_FOUND, ex, request);
    }

    // A file exceeding spring.servlet.multipart.max-file-size/max-request-size (featuresTodo.csv
    // task 10) is a legitimate client error, not a server fault - without this it's a
    // RuntimeException that would otherwise fall through to the generic 500 case below with a
    // framework-internal message, not the clean 400 an oversized-upload deserves.
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleMaxUploadSize(MaxUploadSizeExceededException ex, WebRequest request) {
        return build(HttpStatus.BAD_REQUEST, "Uploaded file exceeds the maximum allowed size.", request);
    }

    // Services in this codebase throw plain RuntimeException for "not found" cases (there's no
    // dedicated exception type yet), so we sniff the message. Anything else is a genuine
    // server error.
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, Object>> handleRuntime(RuntimeException ex, WebRequest request) {
        String message = ex.getMessage() == null ? "" : ex.getMessage().toLowerCase();
        HttpStatus status = message.contains("not found") ? HttpStatus.NOT_FOUND : HttpStatus.INTERNAL_SERVER_ERROR;
        return build(status, ex, request);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleAny(Exception ex, WebRequest request) {
        return build(HttpStatus.INTERNAL_SERVER_ERROR, ex, request);
    }

    private ResponseEntity<Map<String, Object>> build(HttpStatus status, Exception ex, WebRequest request) {
        String message;
        if (status == HttpStatus.INTERNAL_SERVER_ERROR) {
            // Never leak raw exception text (SQL constraint names, NPE internals, file paths,
            // etc.) on a genuine server error - the curated statuses below (400/401/403/404)
            // already have client-facing messages by design, only this case is unvetted.
            log.error("Unhandled exception on {}", request.getDescription(false), ex);
            message = "An unexpected error occurred.";
        } else {
            message = ex.getMessage();
        }
        return build(status, message, request);
    }

    private ResponseEntity<Map<String, Object>> build(HttpStatus status, String message, WebRequest request) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", LocalDateTime.now().toString());
        body.put("status", status.value());
        body.put("error", status.getReasonPhrase());
        body.put("message", message);
        body.put("path", request.getDescription(false).replace("uri=", ""));
        return ResponseEntity.status(status).body(body);
    }
}
