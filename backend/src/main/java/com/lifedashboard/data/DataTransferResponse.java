package com.lifedashboard.data;

public record DataTransferResponse(String backupFile, int tableCount, long rowCount) {
}
