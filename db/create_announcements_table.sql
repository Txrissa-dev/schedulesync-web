-- Create announcements table
CREATE TABLE IF NOT EXISTS announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_announcements_organisation_id ON announcements(organisation_id);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can view announcements in their organisation
CREATE POLICY "Users can view announcements in their organisation"
  ON announcements FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Create policy: Admins can create announcements
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

-- Create policy: Admins and authors can update their announcements
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

-- Create policy: Admins and authors can delete their announcements
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
