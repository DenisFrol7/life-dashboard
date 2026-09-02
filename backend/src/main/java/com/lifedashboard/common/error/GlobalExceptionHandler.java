package com.lifedashboard.common.error;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.http.converter.HttpMessageNotReadableException;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiError> handleNotFound(
            ResourceNotFoundException exception,
            HttpServletRequest request
    ) {
        return build(HttpStatus.NOT_FOUND, exception.getMessage(), request, Map.of());
    }

    @ExceptionHandler({DuplicateResourceException.class, DataIntegrityViolationException.class})
    public ResponseEntity<ApiError> handleConflict(
            RuntimeException exception,
            HttpServletRequest request
    ) {
        String message = exception instanceof DuplicateResourceException
                ? exception.getMessage()
                : "Запрос конфликтует с существующими данными";
        return build(HttpStatus.CONFLICT, message, request, Map.of());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(
            MethodArgumentNotValidException exception,
            HttpServletRequest request
    ) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        exception.getBindingResult().getFieldErrors().forEach(error ->
                fieldErrors.putIfAbsent(error.getField(), validationMessage(error.getDefaultMessage()))
        );
        return build(HttpStatus.BAD_REQUEST, "Проверьте правильность заполнения полей", request, fieldErrors);
    }

    @ExceptionHandler(InvalidRequestException.class)
    public ResponseEntity<ApiError> handleInvalidRequest(
            InvalidRequestException exception,
            HttpServletRequest request
    ) {
        return build(HttpStatus.BAD_REQUEST, exception.getMessage(), request, Map.of());
    }

    @ExceptionHandler({
            MethodArgumentTypeMismatchException.class,
            MissingServletRequestParameterException.class,
            HttpMessageNotReadableException.class
    })
    public ResponseEntity<ApiError> handleMalformedRequest(
            Exception exception,
            HttpServletRequest request
    ) {
        return build(HttpStatus.BAD_REQUEST, "Некорректный формат запроса", request, Map.of());
    }

    private ResponseEntity<ApiError> build(
            HttpStatus status,
            String message,
            HttpServletRequest request,
            Map<String, String> fieldErrors
    ) {
        ApiError error = new ApiError(
                Instant.now(),
                status.value(),
                statusName(status),
                message,
                request.getRequestURI(),
                fieldErrors
        );
        return ResponseEntity.status(status).body(error);
    }

    private String validationMessage(String message) {
        if (message == null) return "Некорректное значение";
        if (message.equals("must not be null") || message.equals("must not be blank")) return "Поле обязательно для заполнения";
        if (message.equals("must be a well-formed email address")) return "Введите корректный адрес электронной почты";
        if (message.equals("must be greater than 0")) return "Значение должно быть больше 0";
        if (message.equals("must be greater than or equal to 0")) return "Значение не может быть отрицательным";
        if (message.startsWith("must be greater than or equal to ")) return "Значение должно быть не меньше " + message.substring(33);
        if (message.startsWith("must be less than or equal to ")) return "Значение должно быть не больше " + message.substring(30);
        if (message.startsWith("size must be between ")) return "Допустимая длина: " + message.substring(21);
        return message;
    }

    private String statusName(HttpStatus status) {
        return switch (status) {
            case BAD_REQUEST -> "Некорректный запрос";
            case NOT_FOUND -> "Не найдено";
            case CONFLICT -> "Конфликт данных";
            default -> "Ошибка";
        };
    }
}
