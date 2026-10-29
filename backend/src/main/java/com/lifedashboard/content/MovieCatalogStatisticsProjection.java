package com.lifedashboard.content;

public interface MovieCatalogStatisticsProjection {
    int getTotalMovies();
    int getInLibrary();
    int getCompleted();
    int getPlanned();
    int getLiveAction();
    int getAnimation();
    int getTotalItems();
}
