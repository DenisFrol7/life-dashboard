package com.lifedashboard.game;

import jakarta.persistence.*;

@Entity
@Table(name = "gaming_platforms")
public class GamingPlatform {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true, length = 50)
    private String code;
    @Column(nullable = false, unique = true, length = 100)
    private String name;
    protected GamingPlatform() {}
    public Long getId() { return id; }
    public String getCode() { return code; }
    public String getName() { return name; }
}
