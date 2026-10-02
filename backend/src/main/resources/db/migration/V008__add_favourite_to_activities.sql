ALTER TABLE activities
    ADD COLUMN favourite BOOLEAN NOT NULL DEFAULT FALSE;

-- Supports the favourite-first ordering in GET /api/v1/activities (Requirement 4) without a full
-- table scan.
CREATE INDEX idx_activities_owner_favourite ON activities(user_id, favourite);
