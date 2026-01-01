-- =====================================================
-- Create Missing Tables for ScheduleSync
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Create teachers table
CREATE TABLE IF NOT EXISTS teachers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  subjects TEXT[], -- Array of subjects the teacher teaches
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_teachers_organisation_id ON teachers(organisation_id);
CREATE INDEX IF NOT EXISTS idx_teachers_email ON teachers(email);

ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view teachers in their organisation"
  ON teachers FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage teachers"
  ON teachers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
      AND organisation_id = teachers.organisation_id
      AND (has_admin_access = true OR is_super_admin = true)
    )
  );

-- 2. Create centres table
CREATE TABLE IF NOT EXISTS centres (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_centres_organisation_id ON centres(organisation_id);

ALTER TABLE centres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view centres in their organisation"
  ON centres FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage centres"
  ON centres FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
      AND organisation_id = centres.organisation_id
      AND (has_admin_access = true OR is_super_admin = true)
    )
  );

-- 3. Create students table
CREATE TABLE IF NOT EXISTS students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  date_of_birth DATE,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_students_organisation_id ON students(organisation_id);
CREATE INDEX IF NOT EXISTS idx_students_name ON students(name);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view students in their organisation"
  ON students FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage students"
  ON students FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
      AND organisation_id = students.organisation_id
      AND (has_admin_access = true OR is_super_admin = true)
    )
  );

-- 4. Create classes table
CREATE TABLE IF NOT EXISTS classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  centre_id UUID REFERENCES centres(id) ON DELETE SET NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room TEXT,
  total_lessons INTEGER,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_classes_organisation_id ON classes(organisation_id);
CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classes_centre_id ON classes(centre_id);
CREATE INDEX IF NOT EXISTS idx_classes_day_of_week ON classes(day_of_week);

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view classes in their organisation"
  ON classes FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage classes"
  ON classes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
      AND organisation_id = classes.organisation_id
      AND (has_admin_access = true OR is_super_admin = true)
    )
  );

-- 5. Create class_students junction table
CREATE TABLE IF NOT EXISTS class_students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(class_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_class_students_class_id ON class_students(class_id);
CREATE INDEX IF NOT EXISTS idx_class_students_student_id ON class_students(student_id);

ALTER TABLE class_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view class students in their organisation"
  ON class_students FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM classes c
      INNER JOIN users u ON u.organisation_id = c.organisation_id
      WHERE c.id = class_students.class_id
      AND u.auth_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage class students"
  ON class_students FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM classes c
      INNER JOIN users u ON u.organisation_id = c.organisation_id
      WHERE c.id = class_students.class_id
      AND u.auth_id = auth.uid()
      AND (u.has_admin_access = true OR u.is_super_admin = true)
    )
  );

-- 6. Create attendance_records table
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  teacher_notes TEXT,
  marked_by TEXT,
  marked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(class_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_records_class_id ON attendance_records(class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_date ON attendance_records(date);

ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attendance in their organisation"
  ON attendance_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM classes c
      INNER JOIN users u ON u.organisation_id = c.organisation_id
      WHERE c.id = attendance_records.class_id
      AND u.auth_id = auth.uid()
    )
  );

CREATE POLICY "Teachers and admins can manage attendance"
  ON attendance_records FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM classes c
      INNER JOIN users u ON u.organisation_id = c.organisation_id
      WHERE c.id = attendance_records.class_id
      AND u.auth_id = auth.uid()
      AND (u.has_admin_access = true OR u.is_super_admin = true OR u.teacher_id = c.teacher_id)
    )
  );

-- 7. Create student_attendance table
CREATE TABLE IF NOT EXISTS student_attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  attendance_record_id UUID NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(attendance_record_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_student_attendance_record_id ON student_attendance(attendance_record_id);
CREATE INDEX IF NOT EXISTS idx_student_attendance_student_id ON student_attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_student_attendance_status ON student_attendance(status);

ALTER TABLE student_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view student attendance in their organisation"
  ON student_attendance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM attendance_records ar
      INNER JOIN classes c ON c.id = ar.class_id
      INNER JOIN users u ON u.organisation_id = c.organisation_id
      WHERE ar.id = student_attendance.attendance_record_id
      AND u.auth_id = auth.uid()
    )
  );

CREATE POLICY "Teachers and admins can manage student attendance"
  ON student_attendance FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM attendance_records ar
      INNER JOIN classes c ON c.id = ar.class_id
      INNER JOIN users u ON u.organisation_id = c.organisation_id
      WHERE ar.id = student_attendance.attendance_record_id
      AND u.auth_id = auth.uid()
      AND (u.has_admin_access = true OR u.is_super_admin = true OR u.teacher_id = c.teacher_id)
    )
  );

-- Add teacher_id column to users table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'teacher_id'
  ) THEN
    ALTER TABLE users ADD COLUMN teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_users_teacher_id ON users(teacher_id);
  END IF;
END $$;
