CREATE TABLE sub_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL,
    user_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_sub_tasks_activity FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
    CONSTRAINT fk_sub_tasks_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT chk_sub_tasks_category CHECK (category IN ('ROUTINE', 'NECESSARY', 'PLEASURABLE'))
);

CREATE INDEX idx_sub_tasks_activity_id ON sub_tasks(activity_id);
CREATE INDEX idx_sub_tasks_user_id ON sub_tasks(user_id);
