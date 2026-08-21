package com.lifedashboard.tag;

import org.jspecify.annotations.NonNull;
import com.lifedashboard.common.error.DuplicateResourceException;
import com.lifedashboard.common.error.ResourceNotFoundException;
import com.lifedashboard.tag.dto.TagRequest;
import com.lifedashboard.tag.dto.TagResponse;
import com.lifedashboard.user.User;
import com.lifedashboard.user.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Service
@Transactional(readOnly = true)
public class TagService {

    private final TagRepository tagRepository;
    private final UserRepository userRepository;
    private final long defaultUserId;

    public TagService(TagRepository tagRepository, UserRepository userRepository,
                      @Value("${app.default-user-id}") long defaultUserId) {
        this.tagRepository = tagRepository;
        this.userRepository = userRepository;
        this.defaultUserId = defaultUserId;
    }

    @Transactional
    public TagResponse create(TagRequest request) {
        String slug = normalizeSlug(request.slug());
        ensureUnique(slug, null);
        User user = userRepository.findById(defaultUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Default user with id " + defaultUserId + " was not found"));
        Tag tag = new Tag(user);
        tag.update(request.name().trim(), slug);
        return toResponse(tagRepository.save(tag));
    }

    public TagResponse getById(Long id) {
        return toResponse(findTag(id));
    }

    public List<TagResponse> getAll() {
        return tagRepository.findAllByUserIdOrderByNameAscIdAsc(defaultUserId).stream()
                .map((@NonNull Tag tag) -> toResponse(tag))
                .toList();
    }

    @Transactional
    public TagResponse update(Long id, TagRequest request) {
        Tag tag = findTag(id);
        String slug = normalizeSlug(request.slug());
        ensureUnique(slug, id);
        tag.update(request.name().trim(), slug);
        return toResponse(tagRepository.save(tag));
    }

    @Transactional
    public void delete(Long id) {
        tagRepository.delete(findTag(id));
    }

    Tag findTag(Long id) {
        return tagRepository.findByIdAndUserId(id, defaultUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Tag with id " + id + " was not found"));
    }

    private void ensureUnique(String slug, Long excludedId) {
        boolean exists = excludedId == null
                ? tagRepository.existsByUserIdAndSlug(defaultUserId, slug)
                : tagRepository.existsByUserIdAndSlugAndIdNot(defaultUserId, slug, excludedId);
        if (exists) {
            throw new DuplicateResourceException("Tag slug is already in use");
        }
    }

    private String normalizeSlug(String slug) {
        return slug.trim().toLowerCase(Locale.ROOT);
    }

    TagResponse toResponse(Tag tag) {
        return new TagResponse(tag.getId(), tag.getName(), tag.getSlug());
    }
}
