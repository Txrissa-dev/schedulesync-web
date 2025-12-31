import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Load environment variables from .env.local
const envFile = readFileSync('.env.local', 'utf-8')
const envVars = {}
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim()
  }
})

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkDatabase() {
  console.log('=== Checking Database ===\n')

  // Get current auth user
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    console.log('No authenticated user found. Please log in first.')
    console.log('Error:', authError)
    return
  }

  console.log('✓ Authenticated user:')
  console.log(`  Email: ${user.email}`)
  console.log(`  Auth ID: ${user.id}\n`)

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', user.id)
    .single()

  if (profileError) {
    console.log('✗ Error fetching profile:', profileError.message)
    return
  }

  console.log('✓ User Profile:')
  console.log(`  ID: ${profile.id}`)
  console.log(`  Username: ${profile.username}`)
  console.log(`  Full Name: ${profile.full_name}`)
  console.log(`  Organisation ID: ${profile.organisation_id || 'NOT SET'}`)
  console.log(`  Has Admin Access: ${profile.has_admin_access}`)
  console.log(`  Is Super Admin: ${profile.is_super_admin}`)
  console.log(`  Teacher ID: ${profile.teacher_id || 'NOT SET'}\n`)

  // Get organisation if exists
  if (profile.organisation_id) {
    const { data: org } = await supabase
      .from('organisations')
      .select('*')
      .eq('id', profile.organisation_id)
      .single()

    if (org) {
      console.log('✓ Organisation:')
      console.log(`  ID: ${org.id}`)
      console.log(`  Name: ${org.name}\n`)
    }

    // Get teachers in this organisation
    const { data: teachers, error: teachersError } = await supabase
      .from('teachers')
      .select('*')
      .eq('organisation_id', profile.organisation_id)

    if (teachersError) {
      console.log('✗ Error fetching teachers:', teachersError.message)
    } else {
      console.log(`✓ Teachers in organisation: ${teachers?.length || 0}`)
      if (teachers && teachers.length > 0) {
        teachers.forEach((teacher, i) => {
          console.log(`  ${i + 1}. ${teacher.full_name} (${teacher.email || 'no email'})`)
        })
      }
      console.log()
    }
  } else {
    console.log('⚠ No organisation assigned to your user account\n')

    // Check all teachers in database
    const { data: allTeachers } = await supabase
      .from('teachers')
      .select('*')

    console.log(`All teachers in database: ${allTeachers?.length || 0}`)
    if (allTeachers && allTeachers.length > 0) {
      allTeachers.forEach((teacher, i) => {
        console.log(`  ${i + 1}. ${teacher.full_name} - Org ID: ${teacher.organisation_id || 'NONE'}`)
      })
    }
    console.log()
  }

  // Check organisations
  const { data: allOrgs } = await supabase
    .from('organisations')
    .select('*')

  console.log(`\n✓ All organisations in database: ${allOrgs?.length || 0}`)
  if (allOrgs && allOrgs.length > 0) {
    allOrgs.forEach((org, i) => {
      console.log(`  ${i + 1}. ${org.name} (ID: ${org.id})`)
    })
  }

  console.log('\n=== Diagnosis ===')
  if (!profile.organisation_id) {
    console.log('❌ Issue: Your user account has NO organisation_id')
    console.log('   Solution: Assign your user to an organisation')
  } else if (!profile.has_admin_access && !profile.is_super_admin) {
    console.log('❌ Issue: Your user account is NOT an admin')
    console.log('   Solution: Set has_admin_access or is_super_admin to true')
  } else {
    console.log('✓ Your account has proper admin access and organisation')
  }
}

checkDatabase()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
