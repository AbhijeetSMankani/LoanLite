package com.loanlite.loanlite.exception;

import org.springframework.http.HttpStatus;

// A deliberately-thrown API error carrying its own HTTP status and a client-facing message,
// for the manual ownership/precondition checks scattered across the controllers (backendTodo.csv
// task 3) that used to return an empty body (ResponseEntity.status(X).build()) instead of the
// consistent JSON error shape GlobalExceptionHandler produces for every other thrown exception.
// Does not replace the codebase's existing IllegalArgumentException/IllegalStateException/
// RuntimeException("...not found...") conventions - see lowPriorityTodo.csv task 4 for that.
public class ApiException extends RuntimeException {

    private final HttpStatus status;

    public ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public static ApiException forbidden(String message) {
        return new ApiException(HttpStatus.FORBIDDEN, message);
    }

    public static ApiException notFound(String message) {
        return new ApiException(HttpStatus.NOT_FOUND, message);
    }

    public static ApiException badRequest(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, message);
    }
}
