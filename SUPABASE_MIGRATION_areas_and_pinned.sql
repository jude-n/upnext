-- ==========================================
-- UpNext — Incremental migration
-- Covers commits 260d5bb (todos.pinned) and 57fdcac (areas)
-- Safe to run against a DB that already has data and the
-- base schema (projects, categories, todos) from earlier commits.
-- Run this in your Supabase SQL Editor.
-- ==========================================

-- ── todos.pinned ──────────────────────────
ALTER TABLE todos ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT FALSE;

-- ── Areas ─────────────────────────────────
CREATE TABLE IF NOT EXISTS areas (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  color      TEXT        NOT NULL DEFAULT '#6366f1' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES areas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS areas_user_id_idx    ON areas(user_id);
CREATE INDEX IF NOT EXISTS projects_area_id_idx ON projects(area_id);

-- ── RLS ───────────────────────────────────
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "areas: owner select" ON areas;
DROP POLICY IF EXISTS "areas: owner insert" ON areas;
DROP POLICY IF EXISTS "areas: owner update" ON areas;
DROP POLICY IF EXISTS "areas: owner delete" ON areas;

CREATE POLICY "areas: owner select" ON areas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "areas: owner insert" ON areas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "areas: owner update" ON areas FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "areas: owner delete" ON areas FOR DELETE USING (auth.uid() = user_id);

-- ── Realtime ──────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'areas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE areas;
  END IF;
END $$;
