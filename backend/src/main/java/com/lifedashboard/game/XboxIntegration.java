package com.lifedashboard.game;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

public final class XboxIntegration {
    private XboxIntegration() {}

    public static boolean supportsProgress(UserGame game) {
        String platformCode = game.getPlatform().getCode();
        if (isXboxPlatform(platformCode)) return true;
        if (!"PC".equals(platformCode) || game.getSource() == null) return false;
        return isMicrosoftPcSource(game.getSource().getCode());
    }

    public static boolean supportsProgress(String platformCode, String sourceCode) {
        return isXboxPlatform(platformCode)
                || "PC".equals(platformCode) && isMicrosoftPcSource(sourceCode);
    }

    public static boolean isXboxPlatform(String platformCode) {
        return platformCode != null
                && (platformCode.startsWith("XBOX_") || platformCode.equals("ORIGINAL_XBOX"));
    }

    public static boolean isMicrosoftPcSource(String sourceCode) {
        return "MICROSOFT_STORE".equals(sourceCode)
                || "GAME_PASS".equals(sourceCode);
    }

    public static boolean supportsPlatform(String platformCode, List<String> devices) {
        if (devices == null || devices.isEmpty()) return true;
        Set<String> normalized = devices.stream().map(XboxIntegration::normalizeDevice)
                .collect(Collectors.toSet());
        return switch (platformCode) {
            case "PC" -> normalized.stream().anyMatch(XboxIntegration::isPcDevice);
            case "XBOX_SERIES" -> normalized.contains("xboxseries")
                    || normalized.contains("xboxone");
            case "XBOX_ONE" -> normalized.contains("xboxone");
            case "XBOX_360" -> normalized.contains("xbox360");
            case "ORIGINAL_XBOX" -> normalized.contains("xbox")
                    || normalized.contains("originalxbox");
            default -> false;
        };
    }

    public static boolean isPcOnly(List<String> devices) {
        if (devices == null) return false;
        boolean pc = devices.stream().map(XboxIntegration::normalizeDevice)
                .anyMatch(XboxIntegration::isPcDevice);
        boolean xbox = devices.stream().map(XboxIntegration::normalizeDevice)
                .anyMatch(device -> device.startsWith("xbox"));
        return pc && !xbox;
    }

    public static boolean isSharedAchievementSet(List<String> devices) {
        if (devices == null) return false;
        boolean pc = devices.stream().map(XboxIntegration::normalizeDevice)
                .anyMatch(XboxIntegration::isPcDevice);
        boolean xbox = devices.stream().map(XboxIntegration::normalizeDevice)
                .anyMatch(device -> device.startsWith("xbox"));
        return pc && xbox;
    }

    private static boolean isPcDevice(String device) {
        return device.contains("pc") || device.contains("windows") || device.contains("win32");
    }

    private static String normalizeDevice(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]", "");
    }
}
