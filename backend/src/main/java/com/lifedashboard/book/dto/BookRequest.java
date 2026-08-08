package com.lifedashboard.book.dto;
import com.lifedashboard.book.BookFormat;
import jakarta.validation.constraints.*;
public record BookRequest(@NotBlank @Size(max=300) String title,@NotBlank @Size(max=300) String author,
        @NotNull BookFormat bookFormat,@Positive Integer pageCount,@Positive Integer releaseYear,
        @Size(max=100) String genre,String coverUrl,String description){}
