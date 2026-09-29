ALTER TABLE activities
    ADD COLUMN repeatable BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE;

-- Supports the new default-excludes-archived list query (Requirement 3) without a full table scan.
CREATE INDEX idx_activities_owner_archived ON activities(user_id, archived);
