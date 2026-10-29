package com.lifedashboard.book;

import com.lifedashboard.content.ContentItemRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class BookCoverCleanup {
    private static final Logger log = LoggerFactory.getLogger(BookCoverCleanup.class);

    private final BookCoverStorage storage;
    private final ContentItemRepository content;
    private final TransactionTemplate transaction;

    public BookCoverCleanup(BookCoverStorage storage, ContentItemRepository content,
            PlatformTransactionManager transactionManager) {
        this.storage = storage;
        this.content = content;
        transaction = new TransactionTemplate(transactionManager);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        transaction.setReadOnly(true);
    }

    public void deleteAfterCommit(String coverUrl) {
        if (!storage.isLocal(coverUrl)) return;
        if (TransactionSynchronizationManager.isActualTransactionActive()
                && TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    deleteIfUnused(coverUrl);
                }
            });
        } else {
            deleteIfUnused(coverUrl);
        }
    }

    private void deleteIfUnused(String coverUrl) {
        try {
            // afterCommit still has the original transaction's resources bound to the thread.
            // A new transaction checks the final, committed references to this file.
            transaction.executeWithoutResult(status -> {
                if (!content.existsByCoverUrl(coverUrl)) storage.deleteIfLocal(coverUrl);
            });
        } catch (RuntimeException exception) {
            // Cleanup must not turn an already committed book change into an API error.
            log.warn("Could not clean up unused book cover '{}'; keeping the file", coverUrl, exception);
        }
    }
}
