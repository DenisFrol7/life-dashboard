package com.lifedashboard.book.googlebooks;
import com.lifedashboard.common.error.InvalidRequestException;
import org.slf4j.*;import org.springframework.beans.factory.annotation.Value;import org.springframework.http.HttpHeaders;import org.springframework.stereotype.Component;import org.springframework.web.client.*;import tools.jackson.databind.JsonNode;import java.util.*;
@Component public class GoogleBooksClient{
 private static final Logger log=LoggerFactory.getLogger(GoogleBooksClient.class);private final RestClient client=RestClient.builder().baseUrl("https://www.googleapis.com/books/v1").build();private final String apiKey;
 public GoogleBooksClient(@Value("${GOOGLE_BOOKS_API_KEY:}")String apiKey){this.apiKey=apiKey.trim();}
 public List<BookData> search(String query){
  try{
   RestClientResponseException last=null;
   for(int attempt=0;attempt<5;attempt++){
    try{return request(query,attempt==0);}
    catch(RestClientResponseException e){last=e;if(e.getStatusCode().value()!=503)throw apiError(e);log.info("Google Books search returned 503; retrying ({}/5)",attempt+1);}
   }
   throw apiError(Objects.requireNonNull(last));
  }catch(RuntimeException e){if(e instanceof InvalidRequestException invalid)throw invalid;log.warn("Google Books search failed: {}",e.toString());throw new InvalidRequestException("Could not connect to Google Books API");}
 }
 private List<BookData> request(String query,boolean orderByRelevance){
  var request=client.get().uri(uri->{var builder=uri.path("/volumes").queryParam("q",query).queryParam("maxResults",12).queryParam("printType","books");if(orderByRelevance)builder.queryParam("orderBy","relevance");return builder.build();}).header(HttpHeaders.ACCEPT,"application/json");
  if(!apiKey.isBlank())request.header("x-goog-api-key",apiKey);
  JsonNode root=request.retrieve().body(JsonNode.class);List<BookData> result=new ArrayList<>();if(root==null)return result;
  for(JsonNode item:root.path("items")){BookData data=map(item);if(data.title()!=null&&!data.author().isBlank())result.add(data);}return List.copyOf(result);
 }
 private InvalidRequestException apiError(RestClientResponseException e){if(e.getStatusCode().value()==429&&apiKey.isBlank())return new InvalidRequestException("Google Books daily limit is exhausted. Add GOOGLE_BOOKS_API_KEY to .env");return new InvalidRequestException("Google Books API request failed with status "+e.getStatusCode().value());}
 private BookData map(JsonNode item){JsonNode info=item.path("volumeInfo");List<String> authors=new ArrayList<>();for(JsonNode v:info.path("authors"))authors.add(v.asString());List<String> categories=new ArrayList<>();for(JsonNode v:info.path("categories"))categories.add(v.asString());String isbn=null;for(JsonNode id:info.path("industryIdentifiers")){String type=text(id,"type");if("ISBN_13".equals(type)){isbn=text(id,"identifier");break;}if(isbn==null&&"ISBN_10".equals(type))isbn=text(id,"identifier");}String published=text(info,"publishedDate");Integer year=null;if(published!=null&&published.length()>=4)try{year=Integer.valueOf(published.substring(0,4));}catch(NumberFormatException ignored){}JsonNode images=info.path("imageLinks");String cover=text(images,"thumbnail");if(cover==null)cover=text(images,"smallThumbnail");if(cover!=null)cover=cover.replace("http://","https://").replace("&edge=curl","");String genre=String.join(", ",categories);if(genre.length()>100)genre=genre.substring(0,100);return new BookData(text(item,"id"),text(info,"title"),String.join(", ",authors),year,published,text(info,"publisher"),positive(info,"pageCount"),genre,text(info,"description"),cover,isbn);}
 private Integer positive(JsonNode n,String f){int v=n.path(f).asInt();return v>0?v:null;}private String text(JsonNode n,String f){JsonNode v=n.path(f);if(v.isMissingNode()||v.isNull())return null;String s=v.asString().trim();return s.isEmpty()?null:s;}
 public record BookData(String id,String title,String author,Integer releaseYear,String publishedDate,String publisher,Integer pageCount,String genre,String description,String coverUrl,String isbn){}
}
