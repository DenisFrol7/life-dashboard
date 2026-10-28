package com.lifedashboard.book;

import com.lifedashboard.user.User;
import jakarta.persistence.*;
import java.time.Instant;

@Entity @Table(name="book_progress", uniqueConstraints=@UniqueConstraint(columnNames={"user_id","book_id"}))
public class BookProgress {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="user_id",nullable=false) private User user;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="book_id",nullable=false) private Book book;
    @Column(name="current_page",nullable=false) private int currentPage;
    @Column(name="current_minute",nullable=false) private int currentMinute;
    @Column(name="updated_at",nullable=false) private Instant updatedAt;
    protected BookProgress(){} public BookProgress(User user,Book book){this.user=user;this.book=book;}
    public void update(int currentPage,int currentMinute){this.currentPage=currentPage;this.currentMinute=currentMinute;this.updatedAt=Instant.now();}
    public Long getId(){return id;} public User getUser(){return user;} public Book getBook(){return book;} public int getCurrentPage(){return currentPage;} public int getCurrentMinute(){return currentMinute;} public Instant getUpdatedAt(){return updatedAt;}
}
