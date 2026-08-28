package com.lifedashboard.content.myshows;

public record MyShowsImportResult(int importedSeries, int skippedSeries, int importedEpisodeWatches,
                                  String backupFile) {}
