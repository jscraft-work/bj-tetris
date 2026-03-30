CREATE TABLE app_user (
    id          BIGSERIAL PRIMARY KEY,
    issuer      VARCHAR(255) NOT NULL,
    subject_id  VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    email       VARCHAR(255),
    username    VARCHAR(255),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_app_user_issuer_subject UNIQUE (issuer, subject_id)
);

CREATE TABLE app_session (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT       NOT NULL REFERENCES app_user (id),
    session_token VARCHAR(128) NOT NULL,
    id_token      VARCHAR(4096),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expires_at    TIMESTAMPTZ  NOT NULL,
    CONSTRAINT uq_app_session_token UNIQUE (session_token)
);

CREATE INDEX idx_app_session_expires_at ON app_session (expires_at);

CREATE TABLE game_record (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT       NOT NULL REFERENCES app_user (id),
    display_name VARCHAR(255) NOT NULL,
    score        INTEGER      NOT NULL,
    level        INTEGER      NOT NULL,
    lines        INTEGER      NOT NULL,
    played_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_game_record_score ON game_record (score DESC, played_at DESC);
CREATE INDEX idx_game_record_user_score ON game_record (user_id, score DESC, played_at DESC);
