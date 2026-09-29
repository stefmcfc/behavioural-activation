CREATE TABLE completion_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    planned_occurrence_id UUID NOT NULL UNIQUE,
    completed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_completion_records_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_completion_records_planned_occurrence FOREIGN KEY (planned_occurrence_id)
        REFERENCES planned_occurrences(id) ON DELETE CASCADE
);

CREATE INDEX idx_completion_records_user_id ON completion_records(user_id);
