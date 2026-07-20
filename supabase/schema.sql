-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. System Metadata Table
CREATE TABLE system_metadata (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial metadata
INSERT INTO system_metadata (key, value) VALUES ('schema_version', '2');
INSERT INTO system_metadata (key, value) VALUES ('last_modified', '0');

-- 2. Hero Section Settings
CREATE TABLE hero_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    image_url TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trigger to maintain a single row constraint in hero_settings
CREATE OR REPLACE FUNCTION check_hero_row_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM hero_settings) >= 1 AND TG_OP = 'INSERT' THEN
        RAISE EXCEPTION 'Hero configuration table can only contain a single row.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_single_hero_row
BEFORE INSERT ON hero_settings
FOR EACH ROW EXECUTE FUNCTION check_hero_row_limit();

-- 3. Portfolio Projects Table
CREATE TABLE portfolio_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sort_order INTEGER NOT NULL CHECK (sort_order >= 1),
    title TEXT DEFAULT '',
    description TEXT DEFAULT '',
    link_url TEXT DEFAULT '',
    image_url TEXT NOT NULL,
    section TEXT DEFAULT 'Section 1',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_portfolio_sort ON portfolio_projects(sort_order);

-- 4. Client Feedbacks Table
CREATE TABLE client_feedbacks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sort_order INTEGER NOT NULL CHECK (sort_order >= 1),
    client_name TEXT NOT NULL,
    feedback_text TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    image_url TEXT DEFAULT '',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_feedback_sort ON client_feedbacks(sort_order);

-- 5. Login Attempts Table (Database-backed serverless rate limiting)
CREATE TABLE login_attempts (
    ip_address VARCHAR(45) PRIMARY KEY,
    failed_count INTEGER DEFAULT 1,
    last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Idempotency Keys Table (Prevents duplicate saves)
CREATE TABLE idempotency_keys (
    key UUID PRIMARY KEY,
    response_status INTEGER NOT NULL,
    response_body JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Trigger to automatically update 'updated_at' column on update operations
CREATE OR REPLACE FUNCTION update_modified_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_hero_timestamp BEFORE UPDATE ON hero_settings FOR EACH ROW EXECUTE FUNCTION update_modified_timestamp();
CREATE TRIGGER update_portfolio_timestamp BEFORE UPDATE ON portfolio_projects FOR EACH ROW EXECUTE FUNCTION update_modified_timestamp();
CREATE TRIGGER update_feedback_timestamp BEFORE UPDATE ON client_feedbacks FOR EACH ROW EXECUTE FUNCTION update_modified_timestamp();

-- 8. Transactional State Sync Function (Includes OCC checks and atomic updates)
CREATE OR REPLACE FUNCTION sync_portfolio_state(
    hero_input JSONB,
    portfolio_input JSONB,
    feedbacks_input JSONB,
    client_last_modified BIGINT
) RETURNS BIGINT AS $$
DECLARE
    current_last_modified BIGINT;
    new_last_modified BIGINT;
BEGIN
    -- Fetch the current global last_modified timestamp
    SELECT COALESCE(value::BIGINT, 0) INTO current_last_modified
    FROM system_metadata
    WHERE key = 'last_modified';

    -- Enforce Optimistic Concurrency Control (OCC)
    IF current_last_modified > client_last_modified THEN
        RAISE EXCEPTION 'OCC_CONFLICT: Database modified by another session. Current: %, Client: %', 
            current_last_modified, client_last_modified;
    END IF;

    -- Update/Insert Hero Configuration
    DELETE FROM hero_settings WHERE TRUE;
    INSERT INTO hero_settings (id, image_url)
    VALUES (
        COALESCE((hero_input->>'id')::UUID, uuid_generate_v4()),
        hero_input->>'imageUrl'
    );

    -- Sync Portfolio Projects
    DELETE FROM portfolio_projects WHERE TRUE;
    INSERT INTO portfolio_projects (id, sort_order, title, description, link_url, image_url, section)
    SELECT 
        COALESCE((elem->>'id')::UUID, uuid_generate_v4()),
        (elem->>'order')::INTEGER,
        COALESCE(elem->>'title', ''),
        COALESCE(elem->>'description', ''),
        COALESCE(elem->>'link', ''),
        elem->>'imageUrl',
        COALESCE(NULLIF(elem->>'section', ''), 'Section 1')
    FROM jsonb_array_elements(portfolio_input) AS elem;

    -- Sync Client Feedbacks
    DELETE FROM client_feedbacks WHERE TRUE;
    INSERT INTO client_feedbacks (id, sort_order, client_name, feedback_text, rating, image_url)
    SELECT 
        COALESCE((elem->>'id')::UUID, uuid_generate_v4()),
        (elem->>'order')::INTEGER,
        elem->>'clientName',
        elem->>'text',
        (elem->>'rating')::INTEGER,
        COALESCE(elem->>'imageUrl', '')
    FROM jsonb_array_elements(feedbacks_input) AS elem;

    -- Generate new epoch millisecond timestamp
    new_last_modified := (extract(epoch from now()) * 1000)::BIGINT;
    
    -- Update global last_modified tracking value
    INSERT INTO system_metadata (key, value)
    VALUES ('last_modified', new_last_modified::TEXT)
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = NOW();

    RETURN new_last_modified;
END;
$$ LANGUAGE plpgsql;
