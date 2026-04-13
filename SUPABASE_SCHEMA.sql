-- ==========================================
-- UpNext — Supabase Schema (Secure Version)
-- Run this in your Supabase SQL Editor
-- ==========================================

-- ── Projects ──────────────────────────────
CREATE TABLE projects (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  color      TEXT        NOT NULL DEFAULT '#6366f1' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  icon       TEXT        DEFAULT '📁' CHECK (char_length(icon) <= 10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Categories ────────────────────────────
CREATE TABLE categories (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  color      TEXT        NOT NULL DEFAULT '#6366f1' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Todos ─────────────────────────────────
CREATE TABLE todos (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 500),
  notes       TEXT        CHECK (notes IS NULL OR char_length(notes) <= 5000),
  completed   BOOLEAN     DEFAULT FALSE,
  due_date    DATE,
  project_id  UUID        REFERENCES projects(id) ON DELETE SET NULL,
  category_id UUID        REFERENCES categories(id) ON DELETE SET NULL,
  tags        TEXT[]      DEFAULT '{}',
  priority    TEXT        DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  sort_order  INTEGER     DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────
CREATE INDEX todos_user_id_idx      ON todos(user_id);
CREATE INDEX todos_due_date_idx     ON todos(due_date);
CREATE INDEX todos_project_id_idx   ON todos(project_id);
CREATE INDEX todos_completed_idx    ON todos(completed);
CREATE INDEX projects_user_id_idx   ON projects(user_id);
CREATE INDEX categories_user_id_idx ON categories(user_id);

-- ── Auto-update updated_at ─────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER todos_updated_at
  BEFORE UPDATE ON todos FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Row Level Security ────────────────────
-- Even if someone has the anon key, they get zero rows
-- unless they are the authenticated owner.

ALTER TABLE todos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects   ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Todos: full CRUD for owner only
CREATE POLICY "todos: owner select" ON todos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "todos: owner insert" ON todos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "todos: owner update" ON todos FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "todos: owner delete" ON todos FOR DELETE USING (auth.uid() = user_id);

-- Projects: full CRUD for owner only
CREATE POLICY "projects: owner select" ON projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "projects: owner insert" ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "projects: owner update" ON projects FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "projects: owner delete" ON projects FOR DELETE USING (auth.uid() = user_id);

-- Categories: full CRUD for owner only
CREATE POLICY "categories: owner select" ON categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "categories: owner insert" ON categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categories: owner update" ON categories FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categories: owner delete" ON categories FOR DELETE USING (auth.uid() = user_id);

-- ── Realtime ──────────────────────────────
-- RLS applies to realtime too — you only receive your own rows
ALTER PUBLICATION supabase_realtime ADD TABLE todos;
ALTER PUBLICATION supabase_realtime ADD TABLE projects;
ALTER PUBLICATION supabase_realtime ADD TABLE categories;
