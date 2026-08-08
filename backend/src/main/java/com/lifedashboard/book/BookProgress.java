package com.lifedashboard.book;

import com.lifedashboard.content.UserContent;
import jakarta.persistence.*;
import java.time.Instant;

@Entity @Table(name="book_progress")
public class BookProgress {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @OneToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="user_content_id",nullable=false,unique=true) private UserContent userContent;
    @Column(name="current_page",nullable=false) private int currentPage;
    @Column(name="current_minute",nullable=false) private int currentMinute;
    @Column(name="updated_at",nullable=false) private Instant updatedAt;
    protected BookProgress(){} public BookProgress(UserContent userContent){this.userContent=userContent;}
    public void update(int currentPage,int currentMinute){this.currentPage=currentPage;this.currentMinute=currentMinute;this.updatedAt=Instant.now();}
    public Long getId(){return id;} public UserContent getUserContent(){return userContent;} public int getCurrentPage(){return currentPage;} public int getCurrentMinute(){return currentMinute;} public Instant getUpdatedAt(){return updatedAt;}
}
