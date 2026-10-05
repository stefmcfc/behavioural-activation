CREATE TABLE work_day_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    day_of_week VARCHAR(10) NOT NULL,
    CONSTRAINT fk_work_day_patterns_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT chk_work_day_patterns_day_of_week CHECK (day_of_week IN
        ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY')),
    CONSTRAINT uq_work_day_patterns_user_day UNIQUE (user_id, day_of_week)
);

CREATE INDEX idx_work_day_patterns_user ON work_day_patterns(user_id);

CREATE TABLE work_day_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    date DATE NOT NULL,
    work_day BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_work_day_overrides_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT uq_work_day_overrides_user_date UNIQUE (user_id, date)
);

CREATE INDEX idx_work_day_overrides_user_date ON work_day_overrides(user_id, date);
