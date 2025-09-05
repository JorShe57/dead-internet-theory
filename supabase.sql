-- Access codes for album and care packages
CREATE TABLE IF NOT EXISTS access_codes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text UNIQUE NOT NULL,
  type text DEFAULT 'album',
  active boolean DEFAULT true,
  created_at timestamp DEFAULT now()
);

-- User sessions
CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_token text UNIQUE NOT NULL,
  created_at timestamp DEFAULT now(),
  last_active timestamp DEFAULT now()
);

-- Social posts
CREATE TABLE IF NOT EXISTS posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  content text NOT NULL,
  author_name text DEFAULT 'Anonymous',
  source text DEFAULT 'web',
  care_package_code text,
  created_at timestamp DEFAULT now(),
  likes integer DEFAULT 0
);

-- Insert test data
INSERT INTO access_codes (code, type) VALUES 
('DEADINTERNET', 'album')
ON CONFLICT (code) DO NOTHING;

INSERT INTO access_codes (code, type) VALUES 
('CAREPACKAGE01', 'special'),
('CAREPACKAGE02', 'special')
ON CONFLICT (code) DO NOTHING;

-- Performance indexes
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts (created_at DESC);
CREATE INDEX IF NOT EXISTS user_sessions_last_active_idx ON user_sessions (last_active DESC);

-- Migration cleanup for prior versions
ALTER TABLE IF EXISTS posts DROP COLUMN IF EXISTS image_url;

-- Likes table to track unique likes per session
CREATE TABLE IF NOT EXISTS post_likes (
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  session_token text NOT NULL,
  created_at timestamp DEFAULT now(),
  PRIMARY KEY (post_id, session_token)
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  content text NOT NULL,
  author_name text DEFAULT 'Anonymous',
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comments_post_id_created_at_idx ON comments (post_id, created_at);

-- --------------------------------------------------------------------
-- Row Level Security (RLS) and Constraints (MUST-HAVES)
-- --------------------------------------------------------------------

-- Enable RLS
ALTER TABLE IF EXISTS posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_sessions ENABLE ROW LEVEL SECURITY;

-- Basic constraints to limit abuse
ALTER TABLE IF EXISTS posts
  ADD CONSTRAINT posts_content_len CHECK (char_length(content) <= 1000) NOT VALID;
ALTER TABLE IF EXISTS comments
  ADD CONSTRAINT comments_content_len CHECK (char_length(content) <= 1000) NOT VALID,
  ADD CONSTRAINT comments_author_len CHECK (char_length(coalesce(author_name,'')) <= 100) NOT VALID;
ALTER TABLE IF EXISTS post_likes
  ADD CONSTRAINT post_likes_token_len CHECK (char_length(session_token) BETWEEN 16 AND 200) NOT VALID;

-- Policies: allow public read, allow simple inserts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'posts_public_read') THEN
    CREATE POLICY posts_public_read ON posts FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'posts_public_insert') THEN
    CREATE POLICY posts_public_insert ON posts FOR INSERT WITH CHECK (true);
  END IF;
  -- Optional: allow likes counter updates (temporary) -- consider replacing with trigger later
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'posts_public_update_likes') THEN
    CREATE POLICY posts_public_update_likes ON posts FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'comments_public_read') THEN
    CREATE POLICY comments_public_read ON comments FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'comments_public_insert') THEN
    CREATE POLICY comments_public_insert ON comments FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'likes_public_read') THEN
    CREATE POLICY likes_public_read ON post_likes FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'likes_public_insert') THEN
    CREATE POLICY likes_public_insert ON post_likes FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'likes_public_delete') THEN
    CREATE POLICY likes_public_delete ON post_likes FOR DELETE USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'sessions_public_read') THEN
    CREATE POLICY sessions_public_read ON user_sessions FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'sessions_public_insert') THEN
    CREATE POLICY sessions_public_insert ON user_sessions FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'sessions_public_delete') THEN
    CREATE POLICY sessions_public_delete ON user_sessions FOR DELETE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE polname = 'sessions_public_update') THEN
    CREATE POLICY sessions_public_update ON user_sessions FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Purge function for expired sessions (24h TTL). Schedule via dashboard or cron.
CREATE OR REPLACE FUNCTION purge_expired_sessions()
RETURNS void LANGUAGE sql AS $$
  DELETE FROM user_sessions WHERE last_active < now() - interval '24 hours';
$$;

-- If pg_cron is available, you can uncomment to schedule daily purge
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('purge_sessions_daily', '@daily', $$DELETE FROM user_sessions WHERE last_active < now() - interval '24 hours';$$);
