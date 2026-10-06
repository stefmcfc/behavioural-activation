ALTER TABLE sub_tasks
    ADD COLUMN position INTEGER;

WITH numbered AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY activity_id ORDER BY created_at ASC) - 1 AS computed_position
    FROM sub_tasks
)
UPDATE sub_tasks
SET position = numbered.computed_position
FROM numbered
WHERE sub_tasks.id = numbered.id;

ALTER TABLE sub_tasks
    ALTER COLUMN position SET NOT NULL;

CREATE INDEX idx_sub_tasks_activity_id_position ON sub_tasks (activity_id, position);
