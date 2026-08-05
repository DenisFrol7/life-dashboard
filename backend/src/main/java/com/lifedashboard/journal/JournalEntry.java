package com.lifedashboard.journal;

import com.lifedashboard.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "journal_entries")
public class JournalEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "entry_date", nullable = false)
    private LocalDate entryDate;

    @Column(length = 300)
    private String title;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Column(name = "is_pinned", nullable = false)
    private boolean pinned;

    @ManyToMany
    @JoinTable(
            name = "journal_entry_tags",
            joinColumns = @JoinColumn(name = "journal_entry_id"),
            inverseJoinColumns = @JoinColumn(name = "tag_id")
    )
    private Set<Tag> tags = new LinkedHashSet<>();

    protected JournalEntry() {
    }

    public JournalEntry(User user) {
        this.user = user;
    }

    public void update(LocalDate entryDate, String title, String content, boolean pinned) {
        this.entryDate = entryDate;
        this.title = title;
        this.content = content;
        this.pinned = pinned;
    }

    public void addTag(Tag tag) { tags.add(tag); }
    public void removeTag(Tag tag) { tags.remove(tag); }

    public Long getId() { return id; }
    public User getUser() { return user; }
    public LocalDate getEntryDate() { return entryDate; }
    public String getTitle() { return title; }
    public String getContent() { return content; }
    public boolean isPinned() { return pinned; }
    public Set<Tag> getTags() { return tags; }
}
