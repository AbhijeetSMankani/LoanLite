package com.loanlite.loanlite.Entities;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "application_history")
public class ApplicationHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id")
    private com.loanlite.loanlite.Entities.LoanApplication application;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private com.loanlite.loanlite.Entities.User user;

    private String action;

    private String details;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    public ApplicationHistory() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public com.loanlite.loanlite.Entities.LoanApplication getApplication() { return application; }
    public void setApplication(com.loanlite.loanlite.Entities.LoanApplication application) { this.application = application; }

    public com.loanlite.loanlite.Entities.User getUser() { return user; }
    public void setUser(com.loanlite.loanlite.Entities.User user) { this.user = user; }

    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }

    public String getDetails() { return details; }
    public void setDetails(String details) { this.details = details; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
