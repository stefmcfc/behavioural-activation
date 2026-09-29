CREATE TABLE planned_occurrences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    activity_id UUID,
    sub_task_id UUID,
    category VARCHAR(20) NOT NULL,
    week_start DATE NOT NULL,
    day_of_week VARCHAR(10),
    slot VARCHAR(10),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_planned_occurrences_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_planned_occurrences_activity FOREIGN KEY (activity_id)
        REFERENCES activities(id) ON DELETE CASCADE,
    CONSTRAINT fk_planned_occurrences_sub_task FOREIGN KEY (sub_task_id)
        REFERENCES sub_tasks(id) ON DELETE CASCADE,
    CONSTRAINT chk_planned_occurrences_category CHECK (category IN ('ROUTINE', 'NECESSARY', 'PLEASURABLE')),
    CONSTRAINT chk_planned_occurrences_slot CHECK (slot IS NULL OR slot IN ('MORNING', 'AFTERNOON', 'EVENING')),
    CONSTRAINT chk_planned_occurrences_day_of_week CHECK (day_of_week IS NULL OR day_of_week IN
        ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY')),
    CONSTRAINT chk_planned_occurrences_day_slot_together CHECK (
        (day_of_week IS NULL AND slot IS NULL) OR (day_of_week IS NOT NULL AND slot IS NOT NULL)
    ),
    CONSTRAINT chk_planned_occurrences_exactly_one_target CHECK (
        (activity_id IS NOT NULL) != (sub_task_id IS NOT NULL)
    )
);

CREATE INDEX idx_planned_occurrences_user_week ON planned_occurrences(user_id, week_start);
CREATE INDEX idx_planned_occurrences_activity_id ON planned_occurrences(activity_id);
CREATE INDEX idx_planned_occurrences_sub_task_id ON planned_occurrences(sub_task_id);
