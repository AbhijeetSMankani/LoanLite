package com.loanlite.loanlite.validation;

import jakarta.validation.ConstraintValidatorContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
public class TenureValidatorTest {

    @Mock
    private ConstraintValidatorContext context;

    private final TenureValidator validator = new TenureValidator();

    @Test
    public void nullValueIsValid() {
        assertThat(validator.isValid(null, context)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(ints = {12, 24, 36, 48, 60})
    public void allowedTenuresAreValid(int tenure) {
        assertThat(validator.isValid(tenure, context)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(ints = {13, 0, -5, 100})
    public void disallowedTenuresAreInvalid(int tenure) {
        assertThat(validator.isValid(tenure, context)).isFalse();
    }
}
