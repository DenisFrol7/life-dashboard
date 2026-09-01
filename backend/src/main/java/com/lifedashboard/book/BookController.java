package com.lifedashboard.book;
import com.lifedashboard.book.dto.*;import com.lifedashboard.content.dto.LibraryEntryRequest;import jakarta.validation.Valid;import org.springframework.core.io.Resource;import org.springframework.http.*;import org.springframework.web.bind.annotation.*;import org.springframework.web.multipart.MultipartFile;import java.net.URI;import java.util.List;import java.util.Map;
@RestController @RequestMapping("/api/books")
public class BookController{
 private final BookService service;private final BookCoverStorage covers;public BookController(BookService service,BookCoverStorage covers){this.service=service;this.covers=covers;}
 @GetMapping public List<BookResponse> all(){return service.getAll();}@GetMapping("/{id}") public BookResponse get(@PathVariable Long id){return service.get(id);}
 @PostMapping public ResponseEntity<BookResponse> create(@Valid @RequestBody BookRequest request){BookResponse result=service.create(request);return ResponseEntity.created(URI.create("/api/books/"+result.id())).body(result);}
 @PutMapping("/{id}") public BookResponse update(@PathVariable Long id,@Valid @RequestBody BookRequest request){return service.update(id,request);}
 @DeleteMapping("/{id}") public ResponseEntity<Void> delete(@PathVariable Long id){service.delete(id);return ResponseEntity.noContent().build();}
 @PostMapping(value="/covers",consumes=MediaType.MULTIPART_FORM_DATA_VALUE) public Map<String,String> uploadCover(@RequestPart("file") MultipartFile file){return Map.of("coverUrl",covers.store(file));}
 @GetMapping("/covers/{filename:.+}") public ResponseEntity<Resource> cover(@PathVariable String filename){return ResponseEntity.ok().contentType(covers.mediaType(filename)).cacheControl(CacheControl.maxAge(java.time.Duration.ofDays(30)).cachePublic()).body(covers.load(filename));}
 @PutMapping("/{id}/library") public BookResponse library(@PathVariable Long id,@Valid @RequestBody LibraryEntryRequest request){return service.putLibrary(id,request);}
 @DeleteMapping("/{id}/library") public BookResponse removeLibrary(@PathVariable Long id){return service.removeLibrary(id);}
 @PutMapping("/{id}/progress") public BookResponse progress(@PathVariable Long id,@Valid @RequestBody BookProgressRequest request){return service.putProgress(id,request);}
 @PostMapping("/{id}/sessions") public ResponseEntity<ReadingSessionResponse> session(@PathVariable Long id,@Valid @RequestBody ReadingSessionRequest request){ReadingSessionResponse result=service.addSession(id,request);return ResponseEntity.created(URI.create("/api/books/"+id+"/sessions/"+result.id())).body(result);}
 @PutMapping("/sessions/{id}") public ReadingSessionResponse updateSession(@PathVariable Long id,@Valid @RequestBody ReadingSessionRequest request){return service.updateSession(id,request);}
 @DeleteMapping("/sessions/{id}") public ResponseEntity<Void> deleteSession(@PathVariable Long id){service.deleteSession(id);return ResponseEntity.noContent().build();}
}
