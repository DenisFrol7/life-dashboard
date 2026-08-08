package com.lifedashboard.book;
import com.lifedashboard.book.dto.*;import com.lifedashboard.content.dto.LibraryEntryRequest;import jakarta.validation.Valid;import org.springframework.http.*;import org.springframework.web.bind.annotation.*;import java.net.URI;import java.util.List;
@RestController @RequestMapping("/api/books")
public class BookController{
 private final BookService service;public BookController(BookService service){this.service=service;}
 @GetMapping public List<BookResponse> all(){return service.getAll();}@GetMapping("/{id}") public BookResponse get(@PathVariable Long id){return service.get(id);}
 @PostMapping public ResponseEntity<BookResponse> create(@Valid @RequestBody BookRequest request){BookResponse result=service.create(request);return ResponseEntity.created(URI.create("/api/books/"+result.id())).body(result);}
 @PutMapping("/{id}") public BookResponse update(@PathVariable Long id,@Valid @RequestBody BookRequest request){return service.update(id,request);}
 @DeleteMapping("/{id}") public ResponseEntity<Void> delete(@PathVariable Long id){service.delete(id);return ResponseEntity.noContent().build();}
 @PutMapping("/{id}/library") public BookResponse library(@PathVariable Long id,@Valid @RequestBody LibraryEntryRequest request){return service.putLibrary(id,request);}
 @DeleteMapping("/{id}/library") public BookResponse removeLibrary(@PathVariable Long id){return service.removeLibrary(id);}
 @PutMapping("/{id}/progress") public BookResponse progress(@PathVariable Long id,@Valid @RequestBody BookProgressRequest request){return service.putProgress(id,request);}
 @PostMapping("/{id}/sessions") public ResponseEntity<ReadingSessionResponse> session(@PathVariable Long id,@Valid @RequestBody ReadingSessionRequest request){ReadingSessionResponse result=service.addSession(id,request);return ResponseEntity.created(URI.create("/api/books/"+id+"/sessions/"+result.id())).body(result);}
}
