package com.lifedashboard.journal;

import com.lifedashboard.common.error.InvalidRequestException;
import com.lifedashboard.common.error.ResourceNotFoundException;
import com.lifedashboard.journal.dto.JournalEntryRequest;
import com.lifedashboard.journal.dto.JournalEntryResponse;
import com.lifedashboard.tag.Tag;
import com.lifedashboard.tag.TagRepository;
import com.lifedashboard.tag.dto.TagResponse;
import com.lifedashboard.user.User;
import com.lifedashboard.user.UserRepository;
import org.jspecify.annotations.NonNull;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class JournalService {

    private final JournalEntryRepository entryRepository;
    private final TagRepository tagRepository;
    private final UserRepository userRepository;
    private final long defaultUserId;

    public JournalService(JournalEntryRepository entryRepository, TagRepository tagRepository,
                          UserRepository userRepository, @Value("${app.default-user-id}") long defaultUserId) {
        this.entryRepository = entryRepository;
        this.tagRepository = tagRepository;
        this.userRepository = userRepository;
        this.defaultUserId = defaultUserId;
    }

    @Transactional
    public JournalEntryResponse create(JournalEntryRequest request) {
        User user = userRepository.findById(defaultUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Пользователь с идентификатором " + defaultUserId + " не найден"));
        JournalEntry entry = new JournalEntry(user);
        apply(entry, request);
        return toResponse(entryRepository.save(entry));
    }

    public JournalEntryResponse getById(Long id) {
        return toResponse(findEntry(id));
    }

    public List<JournalEntryResponse> getAll(
            LocalDate from,
            LocalDate to,
            Boolean pinned,
            String tagSlug
    ) {
        if (from != null && to != null && to.isBefore(from)) {
            throw new InvalidRequestException("Конец периода не может быть раньше его начала");
        }
        String normalizedTag = tagSlug == null || tagSlug.isBlank()
                ? null
                : tagSlug.trim().toLowerCase(java.util.Locale.ROOT);
        Specification<JournalEntry> specification = (root, query, builder) ->
                builder.equal(root.get("user").get("id"), defaultUserId);
        if (from != null) {
            specification = specification.and((root, query, builder) ->
                    builder.greaterThanOrEqualTo(root.get("entryDate"), from));
        }
        if (to != null) {
            specification = specification.and((root, query, builder) ->
                    builder.lessThanOrEqualTo(root.get("entryDate"), to));
        }
        if (pinned != null) {
            specification = specification.and((root, query, builder) -> builder.equal(root.get("pinned"), pinned));
        }
        if (normalizedTag != null) {
            specification = specification.and((root, query, builder) -> {
                query.distinct(true);
                return builder.equal(root.join("tags").get("slug"), normalizedTag);
            });
        }
        Sort sort = Sort.by(Sort.Order.desc("entryDate"), Sort.Order.desc("id"));
        return entryRepository.findAll(specification, sort).stream()
                .map((@NonNull JournalEntry entry) -> toResponse(entry))
                .toList();
    }

    @Transactional
    public JournalEntryResponse update(Long id, JournalEntryRequest request) {
        JournalEntry entry = findEntry(id);
        apply(entry, request);
        return toResponse(entryRepository.save(entry));
    }

    @Transactional
    public void delete(Long id) {
        entryRepository.delete(findEntry(id));
    }

    @Transactional
    public JournalEntryResponse addTag(Long entryId, Long tagId) {
        JournalEntry entry = findEntry(entryId);
        Tag tag = findTag(tagId);
        entry.addTag(tag);
        return toResponse(entryRepository.save(entry));
    }

    @Transactional
    public void removeTag(Long entryId, Long tagId) {
        JournalEntry entry = findEntry(entryId);
        Tag tag = findTag(tagId);
        entry.removeTag(tag);
    }

    private JournalEntry findEntry(Long id) {
        return entryRepository.findByIdAndUserId(id, defaultUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Запись журнала с идентификатором " + id + " не найдена"));
    }

    private Tag findTag(Long id) {
        return tagRepository.findByIdAndUserId(id, defaultUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Тег с идентификатором " + id + " не найден"));
    }

    private void apply(JournalEntry entry, JournalEntryRequest request) {
        entry.update(request.entryDate(), normalizeNullable(request.title()), request.content().trim(), request.pinned());
    }

    private String normalizeNullable(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private JournalEntryResponse toResponse(JournalEntry entry) {
        List<TagResponse> tags = entry.getTags().stream()
                .sorted(Comparator.comparing((@NonNull Tag tag) -> tag.getName())
                        .thenComparing((@NonNull Tag tag) -> tag.getId()))
                .map(tag -> new TagResponse(tag.getId(), tag.getName(), tag.getSlug()))
                .toList();
        return new JournalEntryResponse(entry.getId(), entry.getEntryDate(), entry.getTitle(), entry.getContent(),
                entry.isPinned(), tags);
    }
}
