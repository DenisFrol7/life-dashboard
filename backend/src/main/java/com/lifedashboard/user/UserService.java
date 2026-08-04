package com.lifedashboard.user;

import com.lifedashboard.common.error.DuplicateResourceException;
import com.lifedashboard.common.error.ResourceNotFoundException;
import com.lifedashboard.user.dto.CreateUserRequest;
import com.lifedashboard.user.dto.UpdateUserRequest;
import com.lifedashboard.user.dto.UserResponse;
import jakarta.persistence.EntityManager;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository userRepository;
    private final EntityManager entityManager;

    public UserService(UserRepository userRepository, EntityManager entityManager) {
        this.userRepository = userRepository;
        this.entityManager = entityManager;
    }

    @Transactional
    public UserResponse create(CreateUserRequest request) {
        String username = request.username().trim();
        String email = normalizeNullable(request.email());
        ensureUnique(username, email, null);

        User user = new User(
                username,
                normalizeNullable(request.displayName()),
                email,
                request.timezone().trim()
        );
        userRepository.saveAndFlush(user);
        entityManager.refresh(user);
        return toResponse(user);
    }

    public UserResponse getById(Long id) {
        return toResponse(findById(id));
    }

    public List<UserResponse> getAll() {
        return userRepository.findAll(Sort.by(Sort.Direction.ASC, "id"))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public UserResponse update(Long id, UpdateUserRequest request) {
        User user = findById(id);
        String username = request.username().trim();
        String email = normalizeNullable(request.email());
        ensureUnique(username, email, id);

        user.update(
                username,
                normalizeNullable(request.displayName()),
                email,
                request.timezone().trim()
        );
        userRepository.flush();
        entityManager.refresh(user);
        return toResponse(user);
    }

    @Transactional
    public void delete(Long id) {
        User user = findById(id);
        userRepository.delete(user);
    }

    private User findById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User with id " + id + " was not found"));
    }

    private void ensureUnique(String username, String email, Long excludedId) {
        boolean usernameExists = excludedId == null
                ? userRepository.existsByUsername(username)
                : userRepository.existsByUsernameAndIdNot(username, excludedId);
        if (usernameExists) {
            throw new DuplicateResourceException("Username is already in use");
        }

        if (email == null) {
            return;
        }
        boolean emailExists = excludedId == null
                ? userRepository.existsByEmail(email)
                : userRepository.existsByEmailAndIdNot(email, excludedId);
        if (emailExists) {
            throw new DuplicateResourceException("Email is already in use");
        }
    }

    private String normalizeNullable(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private UserResponse toResponse(User user) {
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getDisplayName(),
                user.getEmail(),
                user.getTimezone(),
                user.getCreatedAt(),
                user.getUpdatedAt()
        );
    }
}
