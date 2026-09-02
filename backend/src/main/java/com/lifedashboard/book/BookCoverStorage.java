package com.lifedashboard.book;

import com.lifedashboard.common.error.InvalidRequestException;
import com.lifedashboard.common.error.ResourceNotFoundException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.URI;
import java.net.URLConnection;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class BookCoverStorage {
    private static final long MAX_BYTES = 5L * 1024 * 1024;
    private static final String PUBLIC_PREFIX = "/api/books/covers/";
    private static final Set<String> ALLOWED_TYPES = Set.of(MediaType.IMAGE_JPEG_VALUE, MediaType.IMAGE_PNG_VALUE, "image/webp");
    private final Path directory;

    public BookCoverStorage(@Value("${app.book-covers-directory:../data/uploads/book-covers}") String directory) {
        this.directory = Path.of(directory).toAbsolutePath().normalize();
        try { Files.createDirectories(this.directory); }
        catch (IOException e) { throw new IllegalStateException("Не удалось создать каталог обложек книг", e); }
    }

    public String store(MultipartFile file) {
        if (file == null || file.isEmpty()) throw new InvalidRequestException("Выберите непустой файл обложки");
        if (file.getSize() > MAX_BYTES) throw new InvalidRequestException("Размер обложки не может превышать 5 МБ");
        try { return storeBytes(readLimited(file.getInputStream()), file.getContentType()); }
        catch (IOException e) { throw new InvalidRequestException("Не удалось прочитать загруженную обложку книги"); }
    }

    public String localize(String coverUrl) {
        String value = normalize(coverUrl);
        if (value == null || isLocal(value)) return value;
        try {
            URI uri = URI.create(value);
            for (int redirect = 0; redirect < 4; redirect++) {
                validateRemote(uri);
                URLConnection connection = uri.toURL().openConnection();
                connection.setConnectTimeout(8_000);
                connection.setReadTimeout(15_000);
                connection.setRequestProperty("User-Agent", "LifeDashboard/1.4");
                if (connection instanceof HttpURLConnection http) {
                    http.setInstanceFollowRedirects(false);
                    int status = http.getResponseCode();
                    if (status >= 300 && status < 400) {
                        String location = http.getHeaderField("Location");
                        if (location == null) throw new InvalidRequestException("Адрес обложки перенаправляет без указания нового адреса");
                        uri = uri.resolve(location);
                        continue;
                    }
                    if (status < 200 || status >= 300) throw new InvalidRequestException("Не удалось загрузить обложку: код ответа " + status);
                }
                try (InputStream input = connection.getInputStream()) {
                    return storeBytes(readLimited(input), connection.getContentType());
                }
            }
            throw new InvalidRequestException("При загрузке обложки произошло слишком много перенаправлений");
        } catch (InvalidRequestException e) {
            throw e;
        } catch (Exception e) {
            throw new InvalidRequestException("Не удалось загрузить обложку книги");
        }
    }

    public Resource load(String filename) {
        Path path = resolve(filename);
        if (!Files.isRegularFile(path)) throw new ResourceNotFoundException("Обложка книги не найдена");
        try { return new UrlResource(path.toUri()); }
        catch (Exception e) { throw new ResourceNotFoundException("Обложка книги не найдена"); }
    }

    public MediaType mediaType(String filename) {
        String lower = filename.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".png")) return MediaType.IMAGE_PNG;
        if (lower.endsWith(".webp")) return MediaType.parseMediaType("image/webp");
        return MediaType.IMAGE_JPEG;
    }

    public void deleteIfLocal(String coverUrl) {
        if (!isLocal(coverUrl)) return;
        try { Files.deleteIfExists(resolve(coverUrl.substring(PUBLIC_PREFIX.length()))); }
        catch (IOException ignored) { }
    }

    private String storeBytes(byte[] bytes, String declaredType) throws IOException {
        String type = detectType(bytes);
        if (type == null || (declaredType != null && declaredType.startsWith("image/") && !ALLOWED_TYPES.contains(type)))
            throw new InvalidRequestException("Поддерживаются только обложки в форматах JPEG, PNG и WebP");
        String extension = type.equals(MediaType.IMAGE_PNG_VALUE) ? ".png" : type.equals("image/webp") ? ".webp" : ".jpg";
        String filename = UUID.randomUUID() + extension;
        Files.write(resolve(filename), bytes, StandardOpenOption.CREATE_NEW);
        return PUBLIC_PREFIX + filename;
    }

    private byte[] readLimited(InputStream input) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int read;
        while ((read = input.read(buffer)) >= 0) {
            if (output.size() + read > MAX_BYTES) throw new InvalidRequestException("Размер обложки не может превышать 5 МБ");
            output.write(buffer, 0, read);
        }
        return output.toByteArray();
    }

    private String detectType(byte[] b) {
        if (b.length >= 3 && (b[0] & 255) == 0xFF && (b[1] & 255) == 0xD8 && (b[2] & 255) == 0xFF) return MediaType.IMAGE_JPEG_VALUE;
        if (b.length >= 8 && (b[0] & 255) == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47) return MediaType.IMAGE_PNG_VALUE;
        if (b.length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F' && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return "image/webp";
        return null;
    }

    private void validateRemote(URI uri) throws Exception {
        if (!("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme())) || uri.getHost() == null)
            throw new InvalidRequestException("Адрес обложки должен использовать HTTP или HTTPS");
        for (InetAddress address : InetAddress.getAllByName(uri.getHost())) {
            if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress()
                    || address.isSiteLocalAddress() || address.isMulticastAddress())
                throw new InvalidRequestException("Адрес обложки указывает на ресурс в частной сети");
        }
    }

    private Path resolve(String filename) {
        Path result = directory.resolve(filename).normalize();
        if (!result.getParent().equals(directory)) throw new InvalidRequestException("Некорректное имя файла обложки");
        return result;
    }

    private boolean isLocal(String value) { return value != null && value.startsWith(PUBLIC_PREFIX); }
    private String normalize(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}
