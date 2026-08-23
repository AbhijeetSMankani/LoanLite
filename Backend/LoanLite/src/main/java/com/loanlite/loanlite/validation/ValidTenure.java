package com.loanlite.loanlite.validation;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

// Plain @Min/@Max can't express "one of exactly these N values" - the project charter requires
// tenureMonths be one of {12, 24, 36, 48, 60} (backendTodo.csv task 7), not just bounded.
@Target({ElementType.FIELD, ElementType.METHOD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = TenureValidator.class)
public @interface ValidTenure {
    String message() default "tenureMonths must be one of 12, 24, 36, 48, 60";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
