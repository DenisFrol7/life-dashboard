package com.lifedashboard.book;

import com.lifedashboard.common.error.InvalidRequestException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class BookCoverStorageTests {
    @TempDir Path directory;

    @Test void storesServesAndDeletesUploadedPng() throws Exception {
        byte[] png = {(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a};
        BookCoverStorage storage = new BookCoverStorage(directory.toString());

        String url = storage.store(new MockMultipartFile("file", "cover.png", "image/png", png));
        String filename = url.substring(url.lastIndexOf('/') + 1);

        assertTrue(url.startsWith("/api/books/covers/"));
        assertArrayEquals(png, storage.load(filename).getContentAsByteArray());
        storage.deleteIfLocal(url);
        assertFalse(Files.exists(directory.resolve(filename)));
    }

    @Test void refusesPrivateNetworkUrls() {
        BookCoverStorage storage = new BookCoverStorage(directory.toString());
        assertThrows(InvalidRequestException.class, () -> storage.localize("http://127.0.0.1/cover.jpg"));
    }
}
