package com.lifedashboard.blog;

import com.lifedashboard.blog.dto.BlogPostFromJournalRequest;
import com.lifedashboard.blog.dto.BlogPostRequest;
import com.lifedashboard.blog.dto.BlogPostResponse;
import com.lifedashboard.common.error.DuplicateResourceException;
import com.lifedashboard.common.error.InvalidRequestException;
import com.lifedashboard.common.error.ResourceNotFoundException;
import com.lifedashboard.journal.JournalEntry;
import com.lifedashboard.journal.JournalEntryRepository;
import com.lifedashboard.journal.Tag;
import com.lifedashboard.journal.TagRepository;
import com.lifedashboard.journal.dto.TagResponse;
import com.lifedashboard.user.User;
import com.lifedashboard.user.UserRepository;
import org.jspecify.annotations.NonNull;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Service
@Transactional(readOnly = true)
public class BlogPostService {

    private final BlogPostRepository postRepository;
    private final JournalEntryRepository journalEntryRepository;
    private final TagRepository tagRepository;
    private final UserRepository userRepository;
    private final long defaultUserId;

    public BlogPostService(BlogPostRepository postRepository, JournalEntryRepository journalEntryRepository,
                           TagRepository tagRepository, UserRepository userRepository,
                           @Value("${app.default-user-id}") long defaultUserId) {
        this.postRepository = postRepository;
        this.journalEntryRepository = journalEntryRepository;
        this.tagRepository = tagRepository;
        this.userRepository = userRepository;
        this.defaultUserId = defaultUserId;
    }

    @Transactional
    public BlogPostResponse create(BlogPostRequest request) {
        String slug = normalizeSlug(request.slug());
        ensureUnique(slug, null);
        BlogPost post = new BlogPost(findDefaultUser(), null);
        apply(post, request, slug);
        return toResponse(postRepository.save(post));
    }

    @Transactional
    public BlogPostResponse createFromJournal(Long journalEntryId, BlogPostFromJournalRequest request) {
        JournalEntry journalEntry = journalEntryRepository.findByIdAndUserId(journalEntryId, defaultUserId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Journal entry with id " + journalEntryId + " was not found"));
        String slug = normalizeSlug(request.slug());
        ensureUnique(slug, null);
        String title = normalizeNullable(request.title());
        if (title == null) {
            title = journalEntry.getTitle() == null
                    ? "Journal entry " + journalEntry.getEntryDate()
                    : journalEntry.getTitle();
        }
        BlogPost post = new BlogPost(journalEntry.getUser(), journalEntry);
        post.update(title, slug, normalizeNullable(request.excerpt()), journalEntry.getContent(),
                normalizeNullable(request.coverImageUrl()), BlogPostStatus.DRAFT, null);
        journalEntry.getTags().forEach((@NonNull Tag tag) -> post.addTag(tag));
        return toResponse(postRepository.save(post));
    }

    public BlogPostResponse getById(Long id) {
        return toResponse(findPost(id));
    }

    public List<BlogPostResponse> getAll(
            BlogPostStatus status,
            String tagSlug,
            Instant publishedFrom,
            Instant publishedTo
    ) {
        if (publishedFrom != null && publishedTo != null && publishedTo.isBefore(publishedFrom)) {
            throw new InvalidRequestException("publishedTo must not be before publishedFrom");
        }
        Specification<BlogPost> specification = (root, query, builder) ->
                builder.equal(root.get("user").get("id"), defaultUserId);
        if (status != null) {
            specification = specification.and((root, query, builder) -> builder.equal(root.get("status"), status));
        }
        if (publishedFrom != null) {
            specification = specification.and((root, query, builder) ->
                    builder.greaterThanOrEqualTo(root.get("publishedAt"), publishedFrom));
        }
        if (publishedTo != null) {
            specification = specification.and((root, query, builder) ->
                    builder.lessThanOrEqualTo(root.get("publishedAt"), publishedTo));
        }
        String normalizedTag = tagSlug == null || tagSlug.isBlank() ? null : normalizeSlug(tagSlug);
        if (normalizedTag != null) {
            specification = specification.and((root, query, builder) -> {
                query.distinct(true);
                return builder.equal(root.join("tags").get("slug"), normalizedTag);
            });
        }
        Sort sort = Sort.by(Sort.Order.desc("publishedAt"), Sort.Order.desc("id"));
        return postRepository.findAll(specification, sort).stream().map(this::toResponse).toList();
    }

    @Transactional
    public BlogPostResponse update(Long id, BlogPostRequest request) {
        BlogPost post = findPost(id);
        String slug = normalizeSlug(request.slug());
        ensureUnique(slug, id);
        apply(post, request, slug);
        return toResponse(postRepository.save(post));
    }

    @Transactional
    public void delete(Long id) {
        postRepository.delete(findPost(id));
    }

    @Transactional
    public BlogPostResponse addTag(Long postId, Long tagId) {
        BlogPost post = findPost(postId);
        post.addTag(findTag(tagId));
        return toResponse(postRepository.save(post));
    }

    @Transactional
    public void removeTag(Long postId, Long tagId) {
        BlogPost post = findPost(postId);
        post.removeTag(findTag(tagId));
    }

    private void apply(BlogPost post, BlogPostRequest request, String slug) {
        Instant publishedAt = switch (request.status()) {
            case PUBLISHED -> post.getPublishedAt() == null ? Instant.now() : post.getPublishedAt();
            case DRAFT -> null;
            case ARCHIVED -> post.getPublishedAt();
        };
        post.update(request.title().trim(), slug, normalizeNullable(request.excerpt()), request.content().trim(),
                normalizeNullable(request.coverImageUrl()), request.status(), publishedAt);
    }

    private BlogPost findPost(Long id) {
        return postRepository.findByIdAndUserId(id, defaultUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Blog post with id " + id + " was not found"));
    }

    private Tag findTag(Long id) {
        return tagRepository.findByIdAndUserId(id, defaultUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Tag with id " + id + " was not found"));
    }

    private User findDefaultUser() {
        return userRepository.findById(defaultUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Default user with id " + defaultUserId + " was not found"));
    }

    private void ensureUnique(String slug, Long excludedId) {
        boolean exists = excludedId == null
                ? postRepository.existsByUserIdAndSlug(defaultUserId, slug)
                : postRepository.existsByUserIdAndSlugAndIdNot(defaultUserId, slug, excludedId);
        if (exists) {
            throw new DuplicateResourceException("Blog post slug is already in use");
        }
    }

    private String normalizeSlug(String slug) {
        return slug.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeNullable(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private BlogPostResponse toResponse(BlogPost post) {
        List<TagResponse> tags = post.getTags().stream()
                .sorted(Comparator.comparing((@NonNull Tag tag) -> tag.getName())
                        .thenComparing((@NonNull Tag tag) -> tag.getId()))
                .map(tag -> new TagResponse(tag.getId(), tag.getName(), tag.getSlug()))
                .toList();
        Long journalEntryId = post.getSourceJournalEntry() == null ? null : post.getSourceJournalEntry().getId();
        return new BlogPostResponse(post.getId(), journalEntryId, post.getTitle(), post.getSlug(), post.getExcerpt(),
                post.getContent(), post.getCoverImageUrl(), post.getStatus(), post.getPublishedAt(), tags);
    }
}
