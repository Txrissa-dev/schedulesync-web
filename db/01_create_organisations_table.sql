-- Create organisations table
CREATE TABLE IF NOT EXISTS organisations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  country TEXT NOT NULL,
  estimated_users TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_organisations_name ON organisations(name);

-- Enable Row Level Security (RLS)
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can view their own organisation
CREATE POLICY "Users can view their own organisation"
  ON organisations FOR SELECT
  USING (
    id IN (
      SELECT organisation_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Create policy: Super admins can update their organisation
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
