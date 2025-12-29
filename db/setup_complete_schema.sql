-- =====================================================
-- Complete Database Schema Setup
-- Run this in Supabase SQL Editor to set up all tables
-- =====================================================

-- 1. Create organisations table
CREATE TABLE IF NOT EXISTS organisations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  country TEXT NOT NULL,
  estimated_users TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_organisations_name ON organisations(name);

ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own organisation"
  ON organisations FOR SELECT
  USING (
    id IN (
      SELECT organisation_id FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can update their organisation"
  ON organisations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
      AND organisation_id = organisations.id
      AND is_super_admin = true
    )
  );

-- 2. Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  username TEXT NOT NULL,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  is_super_admin BOOLEAN DEFAULT false,
  has_admin_access BOOLEAN DEFAULT false,
  profile_picture_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_organisation_id ON users(organisation_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view users in their organisation"
  ON users FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

CREATE POLICY "Super admins can update users in their organisation"
  ON users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
      AND u.organisation_id = users.organisation_id
      AND u.is_super_admin = true
    )
  );

CREATE POLICY "Admins can create users in their organisation"
  ON users FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
      AND u.organisation_id = users.organisation_id
      AND (u.has_admin_access = true OR u.is_super_admin = true)
    )
  );

CREATE POLICY "Super admins can delete users in their organisation"
  ON users FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
      AND u.organisation_id = users.organisation_id
      AND u.is_super_admin = true
    )
  );

-- 3. Create announcements table (if not exists)
CREATE TABLE IF NOT EXISTS announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_announcements_organisation_id ON announcements(organisation_id);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view announcements in their organisation"
  ON announcements FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Admins can create announcements"
  ON announcements FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
      AND organisation_id = announcements.organisation_id
      AND (has_admin_access = true OR is_super_admin = true)
    )
  );

CREATE POLICY "Admins and authors can update announcements"
  ON announcements FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
      AND organisation_id = announcements.organisation_id
      AND (
        has_admin_access = true
        OR is_super_admin = true
        OR id = announcements.author_id
      )
    )
  );

CREATE POLICY "Admins and authors can delete announcements"
  ON announcements FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
      AND organisation_id = announcements.organisation_id
      AND (
        has_admin_access = true
        OR is_super_admin = true
        OR id = announcements.author_id
      )
    )
  );
