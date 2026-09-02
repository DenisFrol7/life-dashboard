package com.lifedashboard.book.googlebooks;

import com.lifedashboard.book.Book;
import com.lifedashboard.book.BookRepository;
import com.lifedashboard.common.error.InvalidRequestException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.text.Normalizer;

@Service
@Transactional(readOnly = true)
public class GoogleBooksService {
    private final GoogleBooksClient google;
    private final BookRepository books;

    public GoogleBooksService(GoogleBooksClient google, BookRepository books) {
        this.google = google;
        this.books = books;
    }

    public List<GoogleBookCandidate> search(String query) {
        String value = query == null ? "" : query.trim();
        if (value.length() < 2) throw new InvalidRequestException("Запрос для поиска книги должен содержать не менее 2 символов");

        String digits = value.replaceAll("[^0-9Xx]", "");
        boolean isbnSearch = digits.length() >= 10;
        List<GoogleBooksClient.BookData> results = google.search(isbnSearch ? "isbn:" + digits : value);
        if (isbnSearch && results.size() == 1 && incomplete(results.getFirst())) {
            results = List.of(enrich(results.getFirst()));
        }
        return results.stream().map(data -> candidate(data, findExisting(data))).toList();
    }

    private GoogleBooksClient.BookData enrich(GoogleBooksClient.BookData exact) {
        String enrichmentQuery = enrichmentQuery(exact);
        if (enrichmentQuery.isBlank()) return exact;

        List<GoogleBooksClient.BookData> alternatives = google.search(enrichmentQuery);
        List<GoogleBooksClient.BookData> verified = alternatives.stream()
                .filter(candidate -> candidate.id() != null && !candidate.id().equals(exact.id()))
                .filter(candidate -> sameWork(exact, candidate))
                .toList();
        GoogleBooksClient.BookData closeEdition = verified.stream()
                .filter(candidate -> hasCyrillic(candidate.title()) || hasCyrillic(candidate.author()))
                .findFirst().orElse(verified.stream().findFirst().orElse(null));

        String title = closeEdition == null ? exact.title() : preferCyrillic(exact.title(), closeEdition.title());
        String author = closeEdition == null ? exact.author() : preferCyrillic(exact.author(), closeEdition.author());
        String genre = firstPresent(exact.genre(), verified.stream().map(GoogleBooksClient.BookData::genre).filter(this::present).findFirst().orElse(null));
        String description = firstPresent(exact.description(), verified.stream().map(GoogleBooksClient.BookData::description).filter(this::hasCyrillic).findFirst().orElse(null));

        Integer publicationYear = closeEdition != null && closeEdition.releaseYear() != null
                ? closeEdition.releaseYear() : exact.releaseYear();
        String publicationDate = publicationYear == null ? null : publicationYear.toString();

        return new GoogleBooksClient.BookData(exact.id(), title, author, publicationYear, publicationDate,
                exact.publisher(), exact.pageCount(), genre, description, exact.coverUrl(), exact.isbn());
    }

    private boolean incomplete(GoogleBooksClient.BookData data) {
        return !present(data.genre()) || !present(data.description()) || !hasCyrillic(data.author());
    }

    private boolean sameWork(GoogleBooksClient.BookData exact, GoogleBooksClient.BookData candidate) {
        return canonical(exact.title()).equals(canonical(candidate.title()))
                && canonical(surname(exact.author())).equals(canonical(surname(candidate.author())));
    }

    private String preferCyrillic(String current, String alternative) {
        return !hasCyrillic(current) && hasCyrillic(alternative) ? alternative : current;
    }

    private boolean hasCyrillic(String value) { return value != null && value.matches(".*[А-Яа-яЁё].*"); }
    private boolean present(String value) { return value != null && !value.isBlank(); }
    private String firstPresent(String primary, String fallback) { return present(primary) ? primary : fallback; }
    private String nonBlank(String value) { return value == null ? "" : value.trim(); }

    private String surname(String author) {
        String value = nonBlank(author);
        return value.isBlank() ? "" : value.substring(value.lastIndexOf(' ') + 1);
    }

    private String canonical(String value) {
        String normalized = Normalizer.normalize(nonBlank(value).toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        StringBuilder result = new StringBuilder();
        for (char c : normalized.toCharArray()) result.append(transliterate(c));
        return result.toString().replaceAll("[^a-z0-9]", "")
                .replace("iy", "i").replace("ii", "i").replace("yi", "y").replace("yy", "y");
    }

    private String transliterate(char c) {
        return switch (c) {
            case 'а' -> "a"; case 'б' -> "b"; case 'в' -> "v"; case 'г' -> "g";
            case 'д' -> "d"; case 'е', 'ё', 'э' -> "e"; case 'ж' -> "zh"; case 'з' -> "z";
            case 'и', 'й' -> "i"; case 'к' -> "k"; case 'л' -> "l"; case 'м' -> "m";
            case 'н' -> "n"; case 'о' -> "o"; case 'п' -> "p"; case 'р' -> "r";
            case 'с' -> "s"; case 'т' -> "t"; case 'у' -> "u"; case 'ф' -> "f";
            case 'х' -> "kh"; case 'ц' -> "ts"; case 'ч' -> "ch"; case 'ш' -> "sh";
            case 'щ' -> "shch"; case 'ы' -> "y"; case 'ю' -> "yu"; case 'я' -> "ya";
            case 'ь', 'ъ' -> ""; default -> String.valueOf(c);
        };
    }

    private String enrichmentQuery(GoogleBooksClient.BookData data) {
        String surname = surname(data.author());
        String asciiSurname = Normalizer.normalize(surname, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return String.join(" ", nonBlank(data.title()), asciiSurname).trim();
    }

    private Long findExisting(GoogleBooksClient.BookData data) {
        return books.findByGoogleBooksId(data.id())
                .or(() -> data.isbn() == null ? Optional.empty() : books.findFirstByIsbn(isbn(data.isbn())))
                .or(() -> books.findCatalog().stream().filter(book -> same(book, data)).findFirst())
                .map(Book::getId).orElse(null);
    }

    private boolean same(Book book, GoogleBooksClient.BookData data) {
        return norm(book.getContent().getTitle()).equals(norm(data.title())) && norm(book.getAuthor()).equals(norm(data.author()));
    }

    private GoogleBookCandidate candidate(GoogleBooksClient.BookData data, Long existing) {
        return new GoogleBookCandidate(data.id(), data.title(), data.author(), data.releaseYear(), data.publishedDate(),
                data.publisher(), data.pageCount(), data.genre(), data.description(), data.coverUrl(), isbn(data.isbn()), existing);
    }

    private String norm(String value) { return value == null ? "" : value.trim().toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]", ""); }
    private String isbn(String value) { return value == null ? null : value.replaceAll("[^0-9Xx]", "").toUpperCase(Locale.ROOT); }
}
