'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface DashboardStats {
  centres: number
  students: number
  teachers: number
  classes: number
}

interface UserProfile {
  id: string
  organisation_id: string | null
  has_admin_access: boolean
  is_super_admin: boolean
  teacher_id: string | null
  full_name: string | null
}

interface TodayClass {
  id: string
  name: string
  subject: string
  start_time: string
  end_time: string
  room: string | null
  centre_name: string
  student_count: number
}

export default function DashboardPage() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [stats, setStats] = useState<DashboardStats>({ centres: 0, students: 0, teachers: 0, classes: 0 })
  const [todayClasses, setTodayClasses] = useState<TodayClass[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) return

        // Fetch user profile
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('id, organisation_id, has_admin_access, is_super_admin, teacher_id, full_name')
          .eq('auth_id', user.id)
          .single()

        if (profileError) throw profileError

        setUserProfile(profile)

        if (!profile.organisation_id) return

        // Fetch organisation stats
        const [centresRes, studentsRes, teachersRes, classesRes] = await Promise.all([
          supabase
            .from('centres')
            .select('id', { count: 'exact', head: true })
            .eq('organisation_id', profile.organisation_id),
          supabase
            .from('students')
            .select('id', { count: 'exact', head: true })
            .eq('organisation_id', profile.organisation_id),
          supabase
            .from('teachers')
            .select('id', { count: 'exact', head: true })
            .eq('organisation_id', profile.organisation_id),
          supabase
            .from('classes')
            .select('id', { count: 'exact', head: true })
            .eq('organisation_id', profile.organisation_id)
        ])

        setStats({
          centres: centresRes.count || 0,
          students: studentsRes.count || 0,
          teachers: teachersRes.count || 0,
          classes: classesRes.count || 0
        })

        // If user is a teacher, fetch today's classes
        if (profile.teacher_id) {
          const today = new Date()
          const dayOfWeek = today.getDay() // 0 = Sunday, 1 = Monday, etc.

          const { data: classes } = await supabase
            .from('classes')
            .select(`
              id,
              name,
              subject,
              start_time,
              end_time,
              room,
              centres:centre_id (name),
              class_students (student_id)
            `)
            .eq('teacher_id', profile.teacher_id)
            .eq('day_of_week', dayOfWeek)

          if (classes) {
            const formattedClasses = classes.map((c: any) => ({
              id: c.id,
              name: c.name,
              subject: c.subject,
              start_time: c.start_time,
              end_time: c.end_time,
              room: c.room,
              centre_name: c.centres?.name || 'Unknown',
              student_count: c.class_students?.length || 0
            }))
            setTodayClasses(formattedClasses)
          }
        }

      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  if (loading) {
    return <div className="text-center py-12">Loading dashboard...</div>
  }

  const isAdmin = userProfile?.has_admin_access || userProfile?.is_super_admin
  const isTeacher = userProfile?.teacher_id !== null

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Welcome, {userProfile?.full_name || 'User'}
          </h2>
          <p className="text-sm text-gray-600">
            {isAdmin ? 'Administrator' : isTeacher ? 'Teacher' : 'User'} Dashboard
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-blue-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">Centres</h3>
            <p className="text-3xl font-bold text-blue-600">{stats.centres}</p>
            <p className="text-sm text-blue-700 mt-2">Active centres</p>
          </div>

          <div className="bg-green-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-green-900 mb-2">Students</h3>
            <p className="text-3xl font-bold text-green-600">{stats.students}</p>
            <p className="text-sm text-green-700 mt-2">Enrolled students</p>
          </div>

          <div className="bg-purple-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-purple-900 mb-2">Teachers</h3>
            <p className="text-3xl font-bold text-purple-600">{stats.teachers}</p>
            <p className="text-sm text-purple-700 mt-2">Active teachers</p>
          </div>

          <div className="bg-orange-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-orange-900 mb-2">Classes</h3>
            <p className="text-3xl font-bold text-orange-600">{stats.classes}</p>
            <p className="text-sm text-orange-700 mt-2">Total classes</p>
          </div>
        </div>

        {isTeacher && todayClasses.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Classes</h3>
            <div className="space-y-3">
              {todayClasses.map((cls) => (
                <div key={cls.id} className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900">{cls.name}</h4>
                    <p className="text-sm text-gray-600">
                      {cls.subject} • {cls.start_time} - {cls.end_time}
                    </p>
                    <p className="text-sm text-gray-500">
                      {cls.centre_name} {cls.room && `• Room ${cls.room}`} • {cls.student_count} students
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/attendance/${cls.id}`}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm inline-block"
                  >
                    Mark Attendance
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/dashboard/schedules" className="bg-white border-2 border-blue-500 text-blue-600 rounded-lg p-4 hover:bg-blue-50 transition text-center">
              View Schedules
            </Link>
            <Link href="/dashboard/schedules" className="bg-white border-2 border-green-500 text-green-600 rounded-lg p-4 hover:bg-green-50 transition text-center">
              Mark Attendance
            </Link>
            {isAdmin && (
              <>
                <button className="bg-white border-2 border-purple-500 text-purple-600 rounded-lg p-4 hover:bg-purple-50 transition">
                  Manage Staff
                </button>
                <button className="bg-white border-2 border-orange-500 text-orange-600 rounded-lg p-4 hover:bg-orange-50 transition">
                  Reports
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
