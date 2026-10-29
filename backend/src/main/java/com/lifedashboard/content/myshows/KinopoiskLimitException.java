package com.lifedashboard.content.myshows;

import com.lifedashboard.common.error.InvalidRequestException;

public class KinopoiskLimitException extends InvalidRequestException {

    public KinopoiskLimitException(String message) {
        super(message);
    }
}
