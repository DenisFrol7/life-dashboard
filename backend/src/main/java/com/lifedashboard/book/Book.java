package com.lifedashboard.book;

import com.lifedashboard.content.ContentItem;
import jakarta.persistence.*;

@Entity
@Table(name = "books")
public class Book {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @OneToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "content_id", nullable = false, unique = true)
    private ContentItem content;
    @Column(nullable = false, length = 300) private String author;
    @Enumerated(EnumType.STRING) @Column(name = "book_format", nullable = false, length = 20) private BookFormat bookFormat;
    @Column(name = "page_count") private Integer pageCount;
    protected Book() {}
    public Book(ContentItem content) { this.content = content; }
    public void update(String author, BookFormat bookFormat, Integer pageCount) { this.author=author; this.bookFormat=bookFormat; this.pageCount=pageCount; }
    public Long getId(){return id;} public ContentItem getContent(){return content;} public String getAuthor(){return author;}
    public BookFormat getBookFormat(){return bookFormat;} public Integer getPageCount(){return pageCount;}
}
