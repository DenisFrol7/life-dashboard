package com.lifedashboard.common.error;

public class ExternalApiTimeoutException extends RuntimeException {
    public ExternalApiTimeoutException(String apiName, Throwable cause) {
        super("Превышено время ожидания ответа API " + apiName + ". Попробуйте позже.", cause);
    }
}
