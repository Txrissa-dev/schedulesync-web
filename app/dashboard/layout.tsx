'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
      } else {
        setUser(session.user)
        const { data: profile } = await supabase
          .from('users')
          .select('has_admin_access, is_super_admin')
          .eq('auth_id', session.user.id)
          .single()
        setIsAdmin(Boolean(profile?.has_admin_access || profile?.is_super_admin))
        setLoading(false)
      }
    }

    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push('/login')
      } else {
        setUser(session.user)
        supabase
          .from('users')
          .select('has_admin_access, is_super_admin')
          .eq('auth_id', session.user.id)
          .single()
          .then(({ data: profile }) => {
            setIsAdmin(Boolean(profile?.has_admin_access || profile?.is_super_admin))
          })
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="text-lg text-gray-700">Loading...</div>
      </div>
    )
  }

  const tabs = [
    { name: 'Today', href: '/dashboard' },
    { name: 'Schedule', href: '/dashboard/schedules' },
    { name: 'Classes', href: '/dashboard/classes' },
    ...(isAdmin ? [{ name: 'Student Namelist', href: '/dashboard/student-namelist' }] : []),
    { name: 'Profile', href: '/dashboard/profile' },
  ]

  return (
    <div className="min-h-screen bg-brand-bg">
      {/* Top Navigation Bar */}
      <nav className="bg-white shadow-sm border-b border-orange-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:h-16 sm:py-0">
            {/* Logo & Brand */}
            <div className="flex items-center space-x-3">
              <img
                src="/logo.png"
                alt="ScheduleSync Logo"
                className="h-8 w-auto sm:h-10"
              />
            </div>

            {/* User Menu */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:space-x-4 sm:gap-0">
              <span className="text-xs text-gray-700 break-all sm:text-sm sm:break-normal">{user?.email}</span>
              <button
                onClick={handleSignOut}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors sm:w-auto"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Tabs Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="-mx-4 flex gap-4 overflow-x-auto whitespace-nowrap px-4 text-xs sm:mx-0 sm:gap-8 sm:px-0 sm:text-sm" aria-label="Tabs">
            {tabs.map((tab) => {
              const isActive = pathname === tab.href
              return (
                <Link
                  key={tab.name}
                  href={tab.href}
                  className={`
                    py-4 px-1 border-b-2 font-medium text-sm transition-colors
                    ${isActive
                      ? 'border-brand-primary text-brand-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  {tab.name}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
