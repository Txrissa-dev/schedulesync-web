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
  teacher_name: string
  student_count: number
}

interface Announcement {
  id: string
  title: string
  message: string
  created_at: string
  author_name: string
}

export default function DashboardPage() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [stats, setStats] = useState<DashboardStats>({ centres: 0, students: 0, teachers: 0, classes: 0 })
  const [todayClasses, setTodayClasses] = useState<TodayClass[]>([])
  const [allClassesToday, setAllClassesToday] = useState<TodayClass[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false)
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', message: '' })
  const [savingAnnouncement, setSavingAnnouncement] = useState(false)

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
              teachers:teacher_id (full_name),
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
              teacher_name: c.teachers?.full_name || 'Unknown',
              student_count: c.class_students?.length || 0
            }))
            setTodayClasses(formattedClasses)
          }
        }

        // Fetch all classes for today (for admin view)
        const today = new Date()
        const dayOfWeek = today.getDay()

        const { data: allClasses } = await supabase
          .from('classes')
          .select(`
            id,
            name,
            subject,
            start_time,
            end_time,
            room,
            centres:centre_id (name),
            teachers:teacher_id (full_name),
            class_students (student_id)
          `)
          .eq('organisation_id', profile.organisation_id)
          .eq('day_of_week', dayOfWeek)
          .order('start_time')

        if (allClasses) {
          const formattedAllClasses = allClasses.map((c: any) => ({
            id: c.id,
            name: c.name,
            subject: c.subject,
            start_time: c.start_time,
            end_time: c.end_time,
            room: c.room,
            centre_name: c.centres?.name || 'Unknown',
            teacher_name: c.teachers?.full_name || 'Unknown',
            student_count: c.class_students?.length || 0
          }))
          setAllClassesToday(formattedAllClasses)
        }

        // Fetch announcements
        const { data: announcementsData } = await supabase
          .from('announcements')
          .select(`
            id,
            title,
            message,
            created_at,
            users:author_id (full_name)
          `)
          .eq('organisation_id', profile.organisation_id)
          .order('created_at', { ascending: false })
          .limit(5)

        if (announcementsData) {
          const formattedAnnouncements = announcementsData.map((a: any) => ({
            id: a.id,
            title: a.title,
            message: a.message,
            created_at: a.created_at,
            author_name: a.users?.full_name || 'Unknown'
          }))
          setAnnouncements(formattedAnnouncements)
        }

      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  const handleAddAnnouncement = async () => {
    if (!newAnnouncement.title || !newAnnouncement.message || !userProfile) return

    setSavingAnnouncement(true)
    try {
      const { data, error } = await supabase
        .from('announcements')
        .insert({
          title: newAnnouncement.title,
          message: newAnnouncement.message,
          organisation_id: userProfile.organisation_id,
          author_id: userProfile.id
        })
        .select(`
          id,
          title,
          message,
          created_at,
          users:author_id (full_name)
        `)
        .single()

      if (error) throw error

      if (data) {
        const newAnnouncementData = {
          id: data.id,
          title: data.title,
          message: data.message,
          created_at: data.created_at,
          author_name: (data as any).users?.full_name || userProfile.full_name || 'Unknown'
        }
        setAnnouncements([newAnnouncementData, ...announcements])
        setNewAnnouncement({ title: '', message: '' })
        setShowAnnouncementForm(false)
      }
    } catch (error) {
      console.error('Error adding announcement:', error)
      alert('Failed to add announcement')
    } finally {
      setSavingAnnouncement(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading dashboard...</div>
  }

  const isAdmin = userProfile?.has_admin_access || userProfile?.is_super_admin
  const isTeacher = userProfile?.teacher_id !== null

  // Format today's date
  const today = new Date()
  const dateString = today.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Date Header */}
      <div className="mb-6">
        <div className="flex items-baseline gap-2">
          <h1 className="text-2xl font-bold text-brand-primary">{dateString}</h1>
          {isAdmin && (
            <span className="text-sm text-gray-600">(Admin View - All Teachers)</span>
          )}
        </div>
      </div>

      <div className="bg-white shadow-lg rounded-xl border border-orange-100 p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-brand-primary">
            Welcome, {userProfile?.full_name || 'User'}
          </h2>
          <p className="text-sm text-gray-600">
            {isAdmin ? 'Administrator' : isTeacher ? 'Teacher' : 'User'} Dashboard
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-orange-50 rounded-xl p-6 border border-orange-100">
            <h3 className="text-lg font-semibold text-brand-primary mb-2">Centres</h3>
            <p className="text-3xl font-bold text-brand-primary">{stats.centres}</p>
            <p className="text-sm text-orange-700 mt-2">Active centres</p>
          </div>

          <div className="bg-green-50 rounded-xl p-6 border border-green-100">
            <h3 className="text-lg font-semibold text-brand-success mb-2">Students</h3>
            <p className="text-3xl font-bold text-brand-success">{stats.students}</p>
            <p className="text-sm text-green-700 mt-2">Enrolled students</p>
          </div>

          <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
            <h3 className="text-lg font-semibold text-brand-secondary mb-2">Teachers</h3>
            <p className="text-3xl font-bold text-brand-secondary">{stats.teachers}</p>
            <p className="text-sm text-blue-700 mt-2">Active teachers</p>
          </div>

          <div className="bg-amber-50 rounded-xl p-6 border border-amber-100">
            <h3 className="text-lg font-semibold text-brand-warning mb-2">Classes</h3>
            <p className="text-3xl font-bold text-brand-warning">{stats.classes}</p>
            <p className="text-sm text-amber-700 mt-2">Total classes</p>
          </div>
        </div>

        {isTeacher && todayClasses.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Classes</h3>
            <div className="space-y-3">
              {todayClasses.map((cls) => (
                <div key={cls.id} className="bg-gray-50 rounded-lg p-4 flex items-center justify-between border border-gray-200">
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
                    className="px-4 py-2 bg-brand-success text-white rounded-lg hover:bg-green-700 text-sm inline-block transition-colors font-medium"
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
            <Link href="/dashboard/schedules" className="bg-white border-2 border-brand-secondary text-brand-secondary rounded-xl p-4 hover:bg-blue-50 transition text-center font-medium">
              View Schedules
            </Link>
            <Link href="/dashboard/schedules" className="bg-white border-2 border-brand-success text-brand-success rounded-xl p-4 hover:bg-green-50 transition text-center font-medium">
              Mark Attendance
            </Link>
            {isAdmin && (
              <>
                <button className="bg-white border-2 border-brand-warning text-brand-warning rounded-xl p-4 hover:bg-amber-50 transition font-medium">
                  Manage Staff
                </button>
                <button className="bg-white border-2 border-brand-primary text-brand-primary rounded-xl p-4 hover:bg-orange-50 transition font-medium">
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
