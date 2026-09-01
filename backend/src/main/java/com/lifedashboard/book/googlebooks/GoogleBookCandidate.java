package com.lifedashboard.book.googlebooks;
public record GoogleBookCandidate(String googleBooksId,String title,String author,Integer releaseYear,String publishedDate,String publisher,Integer pageCount,String genre,String description,String coverUrl,String isbn,Long existingBookId){}
