package com.lifedashboard.journal;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;
import java.util.List;
import java.time.LocalDate;

public interface JournalEntryRepository extends JpaRepository<JournalEntry, Long>, JpaSpecificationExecutor<JournalEntry> {

    Optional<JournalEntry> findByIdAndUserId(Long id, Long userId);
    long countByUserIdAndEntryDate(Long userId, LocalDate entryDate);
    List<JournalEntry> findAllByUserIdAndEntryDateOrderByIdAsc(Long userId, LocalDate entryDate);
}
