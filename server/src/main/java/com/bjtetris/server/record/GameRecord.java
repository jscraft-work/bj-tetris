package com.bjtetris.server.record;

import com.bjtetris.server.user.AppUser;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "game_record")
public class GameRecord {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false)
  private AppUser user;

  @jakarta.persistence.Column(nullable = false, length = 255)
  private String displayName;

  @jakarta.persistence.Column(nullable = false)
  private int score;

  @jakarta.persistence.Column(nullable = false)
  private int level;

  @jakarta.persistence.Column(nullable = false)
  private int lines;

  @jakarta.persistence.Column(nullable = false)
  private Instant playedAt = Instant.now();

  public Long getId() {
    return id;
  }

  public AppUser getUser() {
    return user;
  }

  public void setUser(AppUser user) {
    this.user = user;
  }

  public String getDisplayName() {
    return displayName;
  }

  public void setDisplayName(String displayName) {
    this.displayName = displayName;
  }

  public int getScore() {
    return score;
  }

  public void setScore(int score) {
    this.score = score;
  }

  public int getLevel() {
    return level;
  }

  public void setLevel(int level) {
    this.level = level;
  }

  public int getLines() {
    return lines;
  }

  public void setLines(int lines) {
    this.lines = lines;
  }

  public Instant getPlayedAt() {
    return playedAt;
  }

  public void setPlayedAt(Instant playedAt) {
    this.playedAt = playedAt;
  }
}
