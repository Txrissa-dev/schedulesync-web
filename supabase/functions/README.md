# Deploying the register-org Edge Function

The `register-org` edge function has been created but needs to be deployed to your Supabase project.

## Option 1: Deploy via Supabase Dashboard (Easiest)

1. Go to your Supabase project: https://app.supabase.com/project/strttcmxregzamgepmcl
2. Navigate to **Edge Functions** in the left sidebar
3. Click **"Create a new function"**
4. Name it: `register-org`
5. Copy and paste the code from `/supabase/functions/register-org/index.ts`
6. Click **"Deploy"**

## Option 2: Deploy via Supabase CLI

1. Install Supabase CLI (if not already installed):
   ```bash
   brew install supabase/tap/supabase
   # or
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   npx supabase login
   ```

3. Link your project:
   ```bash
   npx supabase link --project-ref strttcmxregzamgepmcl
   ```

4. Deploy the function:
   ```bash
   npx supabase functions deploy register-org
   ```

## What the Edge Function Does

The `register-org` function:
- ✅ Validates all required fields (email, password, organisation name, etc.)
- ✅ Checks if organisation name already exists (case-insensitive)
- ✅ Ensures only ONE super admin per organisation
- ✅ Creates the organisation record in `public.organisations`
- ✅ Creates the auth user via Supabase Auth Admin API
- ✅ Creates the user record in `public.users` with `is_super_admin = true`
- ✅ Handles rollback on errors
- ✅ Returns proper error messages for the UI

## Required Environment Variables

The edge function will automatically have access to:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your service role key (for admin operations)

These are set automatically in your Supabase project.

## Testing the Function

After deployment, you can test it from the signup form at http://localhost:3000/login

The form will call:
```javascript
await supabase.functions.invoke('register-org', {
  body: {
    organisation_name: 'Test Org',
    country: 'United States',
    estimated_users: '1–5',
    full_name: 'John Doe',
    email: 'john@example.com',
    password: 'password123'
  }
})
```

## Troubleshooting

If you still get errors after deploying:
1. Check the Edge Function logs in the Supabase Dashboard
2. Ensure your database has the required tables (`organisations`, `users`)
3. Verify the `organisations` table has columns: `id`, `name`, `country`, `estimated_users`
4. Verify the `users` table has columns: `id`, `auth_id`, `email`, `full_name`, `username`, `organisation_id`, `is_super_admin`, `has_admin_access`
