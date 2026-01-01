-- Drop existing lesson_statuses table if it exists (to fix any partial creation)
DROP TABLE IF EXISTS lesson_statuses CASCADE;

-- Create lesson_statuses table for tracking lesson schedules
CREATE TABLE lesson_statuses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  lesson_number INTEGER NOT NULL,
  scheduled_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')),
  attendance_record_id UUID REFERENCES attendance_records(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_lesson_statuses_class_id ON lesson_statuses(class_id);
CREATE INDEX IF NOT EXISTS idx_lesson_statuses_scheduled_date ON lesson_statuses(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_lesson_statuses_status ON lesson_statuses(status);

-- Enable Row Level Security
ALTER TABLE lesson_statuses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view lessons for classes in their organisation
CREATE POLICY "Users can view lessons in their organisation"
  ON lesson_statuses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM classes c
      INNER JOIN users u ON u.organisation_id = c.organisation_id
      WHERE c.id = lesson_statuses.class_id
      AND u.auth_id = auth.uid()
    )
  );

-- Policy: Admins and teachers can update lessons in their organisation
CREATE POLICY "Admins and teachers can update lessons"
  ON lesson_statuses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM classes c
      INNER JOIN users u ON u.organisation_id = c.organisation_id
      WHERE c.id = lesson_statuses.class_id
      AND u.auth_id = auth.uid()
      AND (u.has_admin_access = true OR u.is_super_admin = true OR u.teacher_id = c.teacher_id)
    )
  );

-- Policy: Admins can insert lessons
CREATE POLICY "Admins can create lessons"
  ON lesson_statuses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM classes c
      INNER JOIN users u ON u.organisation_id = c.organisation_id
      WHERE c.id = lesson_statuses.class_id
      AND u.auth_id = auth.uid()
      AND (u.has_admin_access = true OR u.is_super_admin = true)
    )
  );

-- Policy: Admins can delete lessons
CREATE POLICY "Admins can delete lessons"
  ON lesson_statuses FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM classes c
      INNER JOIN users u ON u.organisation_id = c.organisation_id
      WHERE c.id = lesson_statuses.class_id
      AND u.auth_id = auth.uid()
      AND (u.has_admin_access = true OR u.is_super_admin = true)
    )
  );
