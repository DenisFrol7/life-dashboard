package com.lifedashboard.journal;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;

public interface JournalEntryRepository extends JpaRepository<JournalEntry, Long>, JpaSpecificationExecutor<JournalEntry> {

    Optional<JournalEntry> findByIdAndUserId(Long id, Long userId);
}
