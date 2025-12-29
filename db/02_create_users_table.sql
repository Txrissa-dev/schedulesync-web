-- Create users table
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

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_organisation_id ON users(organisation_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can view users in their organisation
CREATE POLICY "Users can view users in their organisation"
  ON users FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Create policy: Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

-- Create policy: Super admins can update users in their organisation
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

-- Create policy: Admins can create users in their organisation
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

-- Create policy: Super admins can delete users in their organisation
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
