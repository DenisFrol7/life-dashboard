package com.lifedashboard.common.error;

import com.lifedashboard.book.BookRepository;
import com.lifedashboard.book.googlebooks.GoogleBooksClient;
import com.lifedashboard.book.googlebooks.GoogleBooksController;
import com.lifedashboard.book.googlebooks.GoogleBooksService;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ExternalApiTimeoutResponseTests {
    @Test
    void returnsGatewayTimeoutWithReadableMessageWithoutInternalDetails() throws Exception {
        var client = mock(GoogleBooksClient.class);
        when(client.search("book")).thenThrow(new ExternalApiTimeoutException("Google Books",
                new SocketTimeoutException("https://example.invalid/?key=secret-key")));
        var controller = new GoogleBooksController(new GoogleBooksService(client, mock(BookRepository.class)));
        var mvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler()).build();

        var response = mvc.perform(get("/api/books/google-books/search").param("query", "book"))
                .andExpect(status().isGatewayTimeout())
                .andExpect(jsonPath("$.status").value(504))
                .andExpect(jsonPath("$.error").value("Превышено время ожидания"))
                .andExpect(jsonPath("$.message").value(containsString("Google Books")))
                .andExpect(jsonPath("$.message").value(containsString("Попробуйте позже")))
                .andExpect(jsonPath("$.path").value("/api/books/google-books/search"))
                .andReturn().getResponse();

        assertFalse(response.getContentAsString(StandardCharsets.UTF_8).contains("secret-key"));
    }
}
