CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(20) NOT NULL,
    description VARCHAR(2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_activities_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT chk_activities_category CHECK (category IN ('ROUTINE', 'NECESSARY', 'PLEASURABLE'))
);

CREATE INDEX idx_activities_user_id ON activities(user_id);
