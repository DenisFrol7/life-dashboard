package com.lifedashboard.book.googlebooks;

import com.lifedashboard.book.*;
import com.lifedashboard.content.ContentItem;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GoogleBooksServiceTests {
    @Mock GoogleBooksClient google; @Mock BookRepository books;

    @Test void convertsIsbnAndMapsEdition(){
        var data=new GoogleBooksClient.BookData("volume-1","Мастер и Маргарита","Михаил Булгаков",2024,"2024-01-01","АСТ",480,"Классика","Описание","cover","978-5-17-118366-2");
        when(google.search("isbn:9785171183662")).thenReturn(List.of(data));when(books.findByGoogleBooksId("volume-1")).thenReturn(Optional.empty());when(books.findFirstByIsbn("9785171183662")).thenReturn(Optional.empty());when(books.findCatalog()).thenReturn(List.of());
        var result=service().search("978-5-17-118366-2").getFirst();
        assertEquals("9785171183662",result.isbn());assertEquals(480,result.pageCount());assertNull(result.existingBookId());
    }

    @Test void marksExistingGoogleEdition(){
        var data=new GoogleBooksClient.BookData("volume-1","Книга","Автор",2020,"2020",null,300,null,null,null,null);
        Book existing=mock(Book.class);when(existing.getId()).thenReturn(42L);when(google.search("Книга")).thenReturn(List.of(data));when(books.findByGoogleBooksId("volume-1")).thenReturn(Optional.of(existing));
        assertEquals(42L,service().search("Книга").getFirst().existingBookId());verify(books,never()).findCatalog();
    }
    @Test void enrichesIncompleteIsbnWithoutReplacingEditionCover(){
        var exact=new GoogleBooksClient.BookData("exact","Budushchee","Dmitri Glukhovskiy",2019,"2019",null,478,"",null,null,"9785171183660");
        var wrong=new GoogleBooksClient.BookData("wrong","Будущее","Другой Автор",2018,"2018",null,480,"Ошибочный жанр","Ошибочное описание",null,"1111111111111");
        var other=new GoogleBooksClient.BookData("other","Будущее","Дмитрий Глуховский",2016,"2016",null,482,"Фантастика","Русское описание","other-cover","9785170919789");
        when(google.search("isbn:9785171183660")).thenReturn(List.of(exact));
        when(google.search("Budushchee Glukhovskiy")).thenReturn(List.of(wrong,other));
        when(books.findByGoogleBooksId("exact")).thenReturn(Optional.empty());
        when(books.findFirstByIsbn("9785171183660")).thenReturn(Optional.empty());
        when(books.findCatalog()).thenReturn(List.of());

        var result=service().search("9785171183660").getFirst();

        assertEquals("Будущее",result.title());
        assertEquals("Дмитрий Глуховский",result.author());
        assertEquals("Фантастика",result.genre());
        assertEquals("Русское описание",result.description());
        assertEquals(2016,result.releaseYear());
        assertEquals("2016",result.publishedDate());
        assertNull(result.coverUrl());
        assertEquals("9785171183660",result.isbn());
        assertEquals("exact",result.googleBooksId());
    }

    private GoogleBooksService service(){return new GoogleBooksService(google,books);}
}
