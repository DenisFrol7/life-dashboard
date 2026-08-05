package com.lifedashboard.content;

import jakarta.persistence.*;

@Entity
@Table(name = "content_items")
public class ContentItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 300)
    private String title;
    @Column(name = "original_title", length = 300)
    private String originalTitle;
    @Enumerated(EnumType.STRING) @Column(name = "item_type", nullable = false, length = 20)
    private ContentType itemType;
    @Enumerated(EnumType.STRING) @Column(length = 20)
    private ContentFormat format;
    @Column(name = "release_year")
    private Integer releaseYear;
    @Column(columnDefinition = "text")
    private String description;
    @Column(name = "cover_url", columnDefinition = "text")
    private String coverUrl;
    @Column(name = "duration_minutes")
    private Integer durationMinutes;
    @Enumerated(EnumType.STRING) @Column(name = "release_status", nullable = false, length = 20)
    private ReleaseStatus releaseStatus;

    protected ContentItem() {}
    public ContentItem(String title) { this.title = title; }
    public void update(String title, String originalTitle, ContentType itemType, ContentFormat format,
                       Integer releaseYear, String description, String coverUrl, Integer durationMinutes,
                       ReleaseStatus releaseStatus) {
        this.title = title; this.originalTitle = originalTitle; this.itemType = itemType; this.format = format;
        this.releaseYear = releaseYear; this.description = description; this.coverUrl = coverUrl;
        this.durationMinutes = durationMinutes; this.releaseStatus = releaseStatus;
    }
    public Long getId() { return id; }
    public String getTitle() { return title; }
    public String getOriginalTitle() { return originalTitle; }
    public ContentType getItemType() { return itemType; }
    public ContentFormat getFormat() { return format; }
    public Integer getReleaseYear() { return releaseYear; }
    public String getDescription() { return description; }
    public String getCoverUrl() { return coverUrl; }
    public Integer getDurationMinutes() { return durationMinutes; }
    public ReleaseStatus getReleaseStatus() { return releaseStatus; }
}
