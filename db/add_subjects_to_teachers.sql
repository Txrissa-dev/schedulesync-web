-- Add subjects column to teachers table
ALTER TABLE teachers
ADD COLUMN IF NOT EXISTS subjects TEXT;
