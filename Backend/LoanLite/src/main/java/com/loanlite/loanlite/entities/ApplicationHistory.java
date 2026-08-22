package com.loanlite.loanlite.entities;

import jakarta.persistence.*;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import java.time.LocalDateTime;
import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.loanlite.loanlite.entities.User;
import com.loanlite.loanlite.entities.LoanApplication;


@Entity
@Table(name = "application_history")
public class ApplicationHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonBackReference(value = "history")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id")
    @OnDelete(action = OnDeleteAction.CASCADE)
    private LoanApplication application;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    @OnDelete(action = OnDeleteAction.CASCADE)
    private User user;

    private String action;

    private String details;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    public ApplicationHistory() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public LoanApplication getApplication() { return application; }
    public void setApplication(LoanApplication application) { this.application = application; }

    // application itself is @JsonBackReference'd out of every response (needed to stop
    // infinite recursion with LoanApplication.applicationHistory), which left no way for a
    // caller to tell which application a history entry belongs to. Exposing just the id here
    // is the minimal fix - callers need this to correlate an entry to its application at all.
    @JsonProperty("applicationId")
    public Long getApplicationId() {
        return application != null ? application.getId() : null;
    }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }

    public String getDetails() { return details; }
    public void setDetails(String details) { this.details = details; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
