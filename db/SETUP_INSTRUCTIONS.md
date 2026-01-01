# Database Setup Instructions

Your Next.js application is experiencing 400 and 406 errors because several database tables are missing from your Supabase project. Follow these steps to fix the issues:

## Problem

The application code references these tables that don't exist in your database:
- ❌ `teachers`
- ❌ `centres`
- ❌ `students`
- ❌ `classes`
- ❌ `class_students`
- ❌ `lesson_statuses`
- ❌ `attendance_records`
- ❌ `student_attendance`

## Solution

Run the SQL migration files in your Supabase SQL Editor.

### Step 1: Access Supabase SQL Editor

1. Go to https://supabase.com/dashboard
2. Select your project: `strttcmxregzamgepmcl`
3. Click on **SQL Editor** in the left sidebar

### Step 2: Run Migration Files (IN ORDER)

Run these SQL files in the following order:

#### 1. First, run `create_missing_tables.sql`
This creates all the core tables (teachers, centres, students, classes, etc.)

```sql
-- Copy and paste the contents of db/create_missing_tables.sql
-- Then click "Run" or press Ctrl+Enter
```

#### 2. Then, run `create_lesson_statuses_table.sql`
This creates the lesson_statuses table with proper RLS policies

```sql
-- Copy and paste the contents of db/create_lesson_statuses_table.sql
-- Then click "Run" or press Ctrl+Enter
```

### Step 3: Verify Tables Were Created

Run this query to verify all tables exist:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see all these tables:
- announcements
- attendance_records
- centres
- class_students
- classes
- lesson_statuses
- organisations
- student_attendance
- students
- teachers
- users

### Step 4: Test the Application

1. Restart your Next.js development server
2. Navigate to the Classes tab and click on a class
   - You should now see lesson schedules (if the class was created with lesson dates)
   - No more 400 errors
3. Navigate to the Schedules tab and click on a class
   - You should be able to access the attendance page
   - No more 406 errors

## Notes

- All tables have Row Level Security (RLS) enabled
- Users can only access data from their own organisation
- Admins have full access to manage data in their organisation
- Teachers can only manage their own classes

## If You Still See Errors

1. Check the browser console for specific error messages
2. Verify that your Supabase environment variables are correct in `.env.local`
3. Make sure you're logged in with a user that has proper permissions
4. Check if RLS policies are enabled by running:
   ```sql
   SELECT schemaname, tablename, rowsecurity
   FROM pg_tables
   WHERE schemaname = 'public';
   ```
