package com.lifedashboard.game;

import jakarta.persistence.*;

@Entity
@Table(name = "game_sources")
public class GameSource {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true, length = 50)
    private String code;
    @Column(nullable = false, unique = true, length = 100)
    private String name;
    @Enumerated(EnumType.STRING) @Column(name = "source_type", nullable = false, length = 20)
    private GameSourceType sourceType;
    protected GameSource() {}
    public Long getId() { return id; }
    public String getCode() { return code; }
    public String getName() { return name; }
    public GameSourceType getSourceType() { return sourceType; }
}
