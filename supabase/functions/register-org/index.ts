// @ts-ignore: Deno Deploy
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Check environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    console.log('Environment check:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      url: supabaseUrl
    })

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Missing environment variables' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Parse request body
    const { organisation_name, country, estimated_users, full_name, email, password } = await req.json()

    // Validate required fields
    if (!organisation_name || !country || !estimated_users || !full_name || !email || !password) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate password length
    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 8 characters' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if organisation name already exists (case-insensitive)
    const { data: existingOrg, error: orgCheckError } = await supabaseAdmin
      .from('organisations')
      .select('id, name')
      .ilike('name', organisation_name)
      .single()

    if (orgCheckError && orgCheckError.code !== 'PGRST116') {
      console.error('Error checking organisation:', orgCheckError)
      return new Response(
        JSON.stringify({ error: 'Failed to check organisation' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (existingOrg) {
      // Check if this organisation already has a super admin
      const { data: existingSuperAdmin, error: superAdminCheckError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('organisation_id', existingOrg.id)
        .eq('is_super_admin', true)
        .single()

      if (superAdminCheckError && superAdminCheckError.code !== 'PGRST116') {
        console.error('Error checking super admin:', superAdminCheckError)
        return new Response(
          JSON.stringify({ error: 'Failed to check super admin' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      if (existingSuperAdmin) {
        return new Response(
          JSON.stringify({ error: 'This organisation already has a super admin' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Use existing organisation
      const orgId = existingOrg.id

      // Create auth user
      console.log('Attempting to create auth user with email:', email)
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name,
        },
      })

      if (authError) {
        console.error('Error creating auth user:', authError)
        console.error('Auth error details:', JSON.stringify(authError, null, 2))
        return new Response(
          JSON.stringify({
            error: authError.message || 'Failed to create user',
            details: authError
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      console.log('Auth user created successfully:', authData.user.id)

      // Create user record in public.users
      const { error: userError } = await supabaseAdmin
        .from('users')
        .insert({
          auth_id: authData.user.id,
          email,
          full_name,
          username: email.split('@')[0],
          organisation_id: orgId,
          is_super_admin: true,
          has_admin_access: true,
        })

      if (userError) {
        console.error('Error creating user record:', userError)
        // Rollback: Delete the auth user
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        return new Response(
          JSON.stringify({ error: 'Failed to create user record' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Super admin account created successfully',
          user_id: authData.user.id,
          organisation_id: orgId,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    } else {
      // Organisation doesn't exist, so we need to create it

      // Create organisation first
      const { data: newOrg, error: createOrgError } = await supabaseAdmin
        .from('organisations')
        .insert({
          name: organisation_name,
          country,
          estimated_users,
        })
        .select()
        .single()

      if (createOrgError) {
        console.error('Error creating organisation:', createOrgError)
        return new Response(
          JSON.stringify({ error: 'Failed to create organisation' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Create auth user
      console.log('Attempting to create auth user with email:', email)
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name,
        },
      })

      if (authError) {
        console.error('Error creating auth user:', authError)
        console.error('Auth error details:', JSON.stringify(authError, null, 2))
        // Rollback: Delete the organisation
        await supabaseAdmin.from('organisations').delete().eq('id', newOrg.id)
        return new Response(
          JSON.stringify({
            error: authError.message || 'Failed to create user',
            details: authError
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      console.log('Auth user created successfully:', authData.user.id)

      // Create user record in public.users
      const { error: userError } = await supabaseAdmin
        .from('users')
        .insert({
          auth_id: authData.user.id,
          email,
          full_name,
          username: email.split('@')[0],
          organisation_id: newOrg.id,
          is_super_admin: true,
          has_admin_access: true,
        })

      if (userError) {
        console.error('Error creating user record:', userError)
        // Rollback: Delete the auth user and organisation
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        await supabaseAdmin.from('organisations').delete().eq('id', newOrg.id)
        return new Response(
          JSON.stringify({ error: 'Failed to create user record' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Organisation and super admin account created successfully',
          user_id: authData.user.id,
          organisation_id: newOrg.id,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'An unexpected error occurred' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
