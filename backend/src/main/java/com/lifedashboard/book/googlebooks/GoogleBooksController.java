package com.lifedashboard.book.googlebooks;
import org.springframework.web.bind.annotation.*;import java.util.List;
@RestController @RequestMapping("/api/books/google-books") public class GoogleBooksController{private final GoogleBooksService service;public GoogleBooksController(GoogleBooksService service){this.service=service;}@GetMapping("/search")public List<GoogleBookCandidate> search(@RequestParam String query){return service.search(query);}}
