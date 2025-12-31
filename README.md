# ScheduleSync Web

Web application for ScheduleSync - A B2B scheduling and attendance management platform for education centres.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth)
- **Deployment**: Port 3000

## Features

- Authentication (Login/Signup)
- Dashboard for Centre Administrators and Teachers/Staff
- Connected to existing Supabase backend (synced with iOS app)

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Access to the Supabase project

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env.local` file with your Supabase credentials:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key

### Development

The development server is managed by the Vibecode platform and runs on port 3000.

## Project Structure

```
/app
  /login          - Authentication page
  /dashboard      - Main dashboard (protected)
  layout.tsx      - Root layout
  page.tsx        - Home page (redirects based on auth status)
/lib
  supabase.ts     - Supabase client (client-side)
  supabase-server.ts - Supabase client (server-side)
/components       - Reusable React components
```

## Database Schema

To be documented based on your Supabase schema.

## Next Steps

1. Share your database schema to populate dashboard with real data
2. Implement schedule management features
3. Add attendance tracking
4. Build role-based access control
