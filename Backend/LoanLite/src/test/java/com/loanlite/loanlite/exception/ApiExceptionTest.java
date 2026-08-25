package com.loanlite.loanlite.exception;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;

public class ApiExceptionTest {

    @Test
    public void forbiddenReturnsForbiddenStatusAndMessage() {
        ApiException ex = ApiException.forbidden("msg");

        assertThat(ex.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(ex.getMessage()).isEqualTo("msg");
    }

    @Test
    public void notFoundReturnsNotFoundStatusAndMessage() {
        ApiException ex = ApiException.notFound("msg");

        assertThat(ex.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(ex.getMessage()).isEqualTo("msg");
    }

    @Test
    public void badRequestReturnsBadRequestStatusAndMessage() {
        ApiException ex = ApiException.badRequest("msg");

        assertThat(ex.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(ex.getMessage()).isEqualTo("msg");
    }

    @Test
    public void isARuntimeException() {
        ApiException ex = ApiException.forbidden("msg");

        assertThat(ex).isInstanceOf(RuntimeException.class);
    }
}
