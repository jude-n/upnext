-- ==========================================
-- UpNext - Supabase Schema
-- Run this in your Supabase SQL Editor
-- ==========================================

-- Projects table
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  icon TEXT DEFAULT '📁',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories table
CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Todos table
CREATE TABLE todos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  notes TEXT,
  completed BOOLEAN DEFAULT FALSE,
  due_date DATE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX todos_due_date_idx ON todos(due_date);
CREATE INDEX todos_project_id_idx ON todos(project_id);
CREATE INDEX todos_completed_idx ON todos(completed);
CREATE INDEX todos_sort_order_idx ON todos(sort_order);

-- Enable Row Level Security (RLS) - optional for single user
-- ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE todos;
ALTER PUBLICATION supabase_realtime ADD TABLE projects;
ALTER PUBLICATION supabase_realtime ADD TABLE categories;

-- Seed some default categories
INSERT INTO categories (name, color) VALUES
  ('Work', '#f59e0b'),
  ('Personal', '#10b981'),
  ('Health', '#ef4444'),
  ('Learning', '#6366f1');

-- Seed a default project
INSERT INTO projects (name, color, icon) VALUES
  ('My First Project', '#6366f1', '🚀');
