package com.loanlite.loanlite.validation;

import java.util.Set;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class TenureValidator implements ConstraintValidator<ValidTenure, Integer> {

    public static final Set<Integer> ALLOWED_TENURES = Set.of(12, 24, 36, 48, 60);

    @Override
    public boolean isValid(Integer value, ConstraintValidatorContext context) {
        // null is a separate concern - pair with @NotNull where presence is required, this
        // validator only judges the value when one is actually given.
        return value == null || ALLOWED_TENURES.contains(value);
    }
}
