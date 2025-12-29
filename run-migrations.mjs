import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Read the SQL file
const sql = readFileSync(join(__dirname, 'db', 'setup_complete_schema.sql'), 'utf-8')

console.log('Running database migrations...')
console.log('SQL Length:', sql.length)

// Split SQL into individual statements and execute them
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'))

console.log(`Found ${statements.length} SQL statements to execute`)

for (let i = 0; i < statements.length; i++) {
  const statement = statements[i]
  if (statement) {
    try {
      console.log(`Executing statement ${i + 1}/${statements.length}...`)
      const { error } = await supabase.rpc('exec_sql', { sql_query: statement })
      if (error) {
        console.error(`Error in statement ${i + 1}:`, error)
      } else {
        console.log(`✓ Statement ${i + 1} executed successfully`)
      }
    } catch (err) {
      console.error(`Exception in statement ${i + 1}:`, err)
    }
  }
}

console.log('Migration complete!')
