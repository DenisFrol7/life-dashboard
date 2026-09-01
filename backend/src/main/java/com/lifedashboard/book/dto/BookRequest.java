package com.lifedashboard.book.dto;
import com.lifedashboard.book.BookFormat;
import jakarta.validation.constraints.*;
public record BookRequest(@NotBlank @Size(max=300) String title,@NotBlank @Size(max=300) String author,
        @NotNull BookFormat bookFormat,@Positive Integer pageCount,@Positive Integer durationMinutes,@Positive Integer releaseYear,
        @Size(max=100) String genre,String coverUrl,String description,@Size(max=100) String googleBooksId,@Size(max=20) String isbn){
    public BookRequest(String title,String author,BookFormat bookFormat,Integer pageCount,Integer durationMinutes,
            Integer releaseYear,String genre,String coverUrl,String description){this(title,author,bookFormat,pageCount,durationMinutes,releaseYear,genre,coverUrl,description,null,null);}
}
