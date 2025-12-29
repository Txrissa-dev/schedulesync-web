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
    // Create Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Parse request body
    const {
      full_name,
      email,
      phone,
      subjects,
      password,
      has_admin_access,
      organisation_id,
      centre_ids
    } = await req.json()

    // Validate required fields
    if (!full_name || !email || !password || !organisation_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields (name, email, password, organisation)' }),
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

    // 1. Create teacher record
    console.log('Creating teacher record...')
    const { data: teacher, error: teacherError } = await supabaseAdmin
      .from('teachers')
      .insert({
        full_name,
        email,
        phone,
        subjects,
        organisation_id
      })
      .select()
      .single()

    if (teacherError) {
      console.error('Error creating teacher:', teacherError)
      return new Response(
        JSON.stringify({ error: `Failed to create teacher: ${teacherError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Teacher created:', teacher.id)

    // 2. Create auth user
    console.log('Creating auth user...')
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
      // Rollback: Delete the teacher
      await supabaseAdmin.from('teachers').delete().eq('id', teacher.id)
      return new Response(
        JSON.stringify({ error: `Failed to create user account: ${authError.message}` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Auth user created:', authData.user.id)

    // 3. Create user record linking auth to teacher
    console.log('Creating user record...')
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        auth_id: authData.user.id,
        email,
        full_name,
        username: email.split('@')[0],
        organisation_id,
        teacher_id: teacher.id,
        has_admin_access: has_admin_access || false,
        is_super_admin: false
      })

    if (userError) {
      console.error('Error creating user record:', userError)
      // Rollback: Delete auth user and teacher
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      await supabaseAdmin.from('teachers').delete().eq('id', teacher.id)
      return new Response(
        JSON.stringify({ error: `Failed to create user record: ${userError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('User record created')

    // 4. Assign centres if provided
    if (centre_ids && centre_ids.length > 0) {
      console.log('Assigning centres...')
      const centreAssignments = centre_ids.map((centreId: string) => ({
        teacher_id: teacher.id,
        centre_id: centreId
      }))

      const { error: centreError } = await supabaseAdmin
        .from('teacher_centres')
        .insert(centreAssignments)

      if (centreError) {
        console.error('Error assigning centres:', centreError)
        // Don't rollback for this - teacher is created, just log the error
      } else {
        console.log(`Assigned ${centre_ids.length} centres`)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Teacher created successfully',
        teacher: teacher,
        user_id: authData.user.id
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
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
