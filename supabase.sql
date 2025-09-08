/* Ensure pgcrypto for UUID generation */
CREATE EXTENSION IF NOT EXISTS pgcrypto;

/* -------------------------------------------------- */
/* 1. Access codes for album and care packages */
CREATE TABLE IF NOT EXISTS public.access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  type text NOT NULL DEFAULT 'album',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

/* Insert seed data – idempotent */
INSERT INTO public.access_codes (code, type)
VALUES 
  ('DEADINTERNET', 'album'),
  ('CAREPACKAGE01', 'special'),
  ('CAREPACKAGE02', 'special')
ON CONFLICT (code) DO NOTHING;

/* -------------------------------------------------- */
/* 2. User sessions (anonymous session tokens; no Supabase Auth user_id) */
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active timestamptz NOT NULL DEFAULT now()
);
-- If a previous version added user_id, drop it to match the app's model
ALTER TABLE public.user_sessions DROP COLUMN IF EXISTS user_id;

/* -------------------------------------------------- */
/* 3. Social posts */
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  author_name text NOT NULL DEFAULT 'Anonymous',
  source text NOT NULL DEFAULT 'web',
  care_package_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  likes int NOT NULL DEFAULT 0
);

/* Indexes for posts */
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON public.posts (created_at DESC);

/* -------------------------------------------------- */
/* 4. Post likes – many‑to‑many between posts and sessions */
CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  session_token text NOT NULL REFERENCES public.user_sessions(session_token) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, session_token)
);

/* Index for fast lookup of recent likes */
CREATE INDEX IF NOT EXISTS post_likes_created_at_idx ON public.post_likes (created_at DESC);

/* -------------------------------------------------- */
/* 5. Comments */
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  content text NOT NULL,
  author_name text NOT NULL DEFAULT 'Anonymous',
  created_at timestamptz NOT NULL DEFAULT now()
);

/* Composite index for comment feeds */
CREATE INDEX IF NOT EXISTS comments_post_id_created_at_idx ON public.comments (post_id, created_at);

/* -------------------------------------------------- */
/* 6. Constraints – added only if they do not already exist */
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_content_len') THEN
    ALTER TABLE public.posts ADD CONSTRAINT posts_content_len CHECK (char_length(content) <= 1000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_content_not_blank') THEN
    ALTER TABLE public.posts ADD CONSTRAINT posts_content_not_blank CHECK (trim(content) <> '');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comments_content_len') THEN
    ALTER TABLE public.comments ADD CONSTRAINT comments_content_len CHECK (char_length(content) <= 1000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comments_author_len') THEN
    ALTER TABLE public.comments ADD CONSTRAINT comments_author_len CHECK (char_length(coalesce(author_name, '')) <= 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comments_content_not_blank') THEN
    ALTER TABLE public.comments ADD CONSTRAINT comments_content_not_blank CHECK (trim(content) <> '');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'post_likes_token_len') THEN
    ALTER TABLE public.post_likes ADD CONSTRAINT post_likes_token_len CHECK (char_length(session_token) BETWEEN 16 AND 200);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_sessions_token_len') THEN
    ALTER TABLE public.user_sessions ADD CONSTRAINT user_sessions_token_len CHECK (char_length(session_token) BETWEEN 16 AND 200);
  END IF;
END $$;

/* -------------------------------------------------- */
/* 7. Row‑Level Security */
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

/* -------------------------------------------------- */
/* 8. Policies – idempotent creation (use pg_policies.policyname) */
DO $$
BEGIN
  -- Check if table exists before creating policies
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'posts' AND table_schema = 'public') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'posts_public_read' AND tablename = 'posts' AND schemaname = 'public') THEN
      CREATE POLICY posts_public_read ON public.posts FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'posts_public_insert' AND tablename = 'posts' AND schemaname = 'public') THEN
      CREATE POLICY posts_public_insert ON public.posts FOR INSERT WITH CHECK (true);
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  -- Check if table exists before creating policies
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'comments' AND table_schema = 'public') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'comments_public_read' AND tablename = 'comments' AND schemaname = 'public') THEN
      CREATE POLICY comments_public_read ON public.comments FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'comments_public_insert' AND tablename = 'comments' AND schemaname = 'public') THEN
      CREATE POLICY comments_public_insert ON public.comments FOR INSERT WITH CHECK (true);
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  -- Check if table exists before creating policies
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'post_likes' AND table_schema = 'public') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'likes_public_read' AND tablename = 'post_likes' AND schemaname = 'public') THEN
      CREATE POLICY likes_public_read ON public.post_likes FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'likes_public_insert' AND tablename = 'post_likes' AND schemaname = 'public') THEN
      CREATE POLICY likes_public_insert ON public.post_likes FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'likes_public_delete' AND tablename = 'post_likes' AND schemaname = 'public') THEN
      CREATE POLICY likes_public_delete ON public.post_likes FOR DELETE USING (true);
    END IF;
  END IF;
END $$;

-- Replace any owner-bound policies with permissive anon policies used by the app
DO $$
BEGIN
  -- Drop old policies if they exist (referenced user_id)
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'sessions_owner_read' AND tablename = 'user_sessions' AND schemaname = 'public') THEN
    DROP POLICY sessions_owner_read ON public.user_sessions;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'sessions_owner_insert' AND tablename = 'user_sessions' AND schemaname = 'public') THEN
    DROP POLICY sessions_owner_insert ON public.user_sessions;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'sessions_owner_update' AND tablename = 'user_sessions' AND schemaname = 'public') THEN
    DROP POLICY sessions_owner_update ON public.user_sessions;
  END IF;

  -- Create the policies our app expects (public read/insert/update/delete)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'sessions_public_read' AND tablename = 'user_sessions' AND schemaname = 'public') THEN
    CREATE POLICY sessions_public_read ON public.user_sessions FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'sessions_public_insert' AND tablename = 'user_sessions' AND schemaname = 'public') THEN
    CREATE POLICY sessions_public_insert ON public.user_sessions FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'sessions_public_update' AND tablename = 'user_sessions' AND schemaname = 'public') THEN
    CREATE POLICY sessions_public_update ON public.user_sessions FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'sessions_public_delete' AND tablename = 'user_sessions' AND schemaname = 'public') THEN
    CREATE POLICY sessions_public_delete ON public.user_sessions FOR DELETE USING (true);
  END IF;
END $$;

/* -------------------------------------------------- */
/* 9. Trigger to keep likes count in sync */
CREATE OR REPLACE FUNCTION public.update_post_likes_counter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET likes = likes + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET likes = GREATEST(likes - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

/* Attach triggers – idempotent (drop first) */
DROP TRIGGER IF EXISTS post_likes_insert_trigger ON public.post_likes;
CREATE TRIGGER post_likes_insert_trigger
  AFTER INSERT ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_post_likes_counter();

DROP TRIGGER IF EXISTS post_likes_delete_trigger ON public.post_likes;
CREATE TRIGGER post_likes_delete_trigger
  AFTER DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_post_likes_counter();

/* -------------------------------------------------- */
/* 10. Function to purge expired sessions (24‑hour TTL) */
CREATE OR REPLACE FUNCTION public.purge_expired_sessions()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.user_sessions WHERE last_active < now() - interval '24 hours';
$$;

/* -------------------------------------------------- */
/* 11. Atomic like‑toggle helper (uses the trigger for the counter) */
CREATE OR REPLACE FUNCTION public.toggle_post_like(
  p_post_id uuid,
  p_session_token text
)
RETURNS TABLE(liked boolean, likes_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists boolean;
  v_new_count integer;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.post_likes WHERE post_id = p_post_id AND session_token = p_session_token) INTO v_exists;

  IF v_exists THEN
    DELETE FROM public.post_likes WHERE post_id = p_post_id AND session_token = p_session_token;
  ELSE
    INSERT INTO public.post_likes (post_id, session_token) VALUES (p_post_id, p_session_token);
  END IF;

  SELECT likes INTO v_new_count FROM public.posts WHERE id = p_post_id;
  RETURN QUERY SELECT NOT v_exists, v_new_count;
END;
$$;

/* -------------------------------------------------- */
/* 12. Optional: schedule purge via pg_cron if extension is available */
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  END IF;
END $$;

/* Uncomment the line below to schedule daily cleanup */
-- SELECT cron.schedule('purge_sessions_daily', '@daily', $$SELECT public.purge_expired_sessions();$$);
