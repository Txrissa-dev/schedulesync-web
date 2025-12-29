-- First, check if there's a trigger on auth.users
SELECT
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users';

-- If there's a trigger that creates users, drop it
-- (Run this after checking the above query)
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- DROP FUNCTION IF EXISTS handle_new_user();

-- Alternative: Make username nullable temporarily
ALTER TABLE public.users ALTER COLUMN username DROP NOT NULL;

-- Or set a default value for username based on email
-- This is better than making it nullable
ALTER TABLE public.users ALTER COLUMN username SET DEFAULT '';
