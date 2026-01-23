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

const getTeacherLabel = (teacher: { full_name?: string | null; name?: string | null } | null) =>
  teacher?.full_name || teacher?.name || 'No teacher assigned'

const formatDateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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
  const [deletingAnnouncementId, setDeletingAnnouncementId] = useState<string | null>(null)
  const [dashboardView, setDashboardView] = useState<'admin' | 'teacher'>('admin')
  const [expandedAnnouncements, setExpandedAnnouncements] = useState<Set<string>>(new Set())
  
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

        const today = new Date()
        const todayKey = formatDateKey(today)

        const { data: todayLessons } = await supabase
          .from('lesson_statuses')
          .select('class_id, co_teacher_id')
          .eq('scheduled_date', todayKey)
          .neq('status', 'rescheduled')
        
        const todayClassIds = todayLessons?.map((lesson) => lesson.class_id) ?? []

        if (todayClassIds.length > 0) {
          // If user is a teacher, fetch today's classes
          if (profile.teacher_id) {
            const coTeacherClassIds = Array.from(
              new Set(
                todayLessons
                  ?.filter((lesson) => lesson.co_teacher_id === profile.teacher_id)
                  .map((lesson) => lesson.class_id) ?? []
              )
            )

            const primaryClassesPromise = supabase
              .from('classes')
              .select(`
                id,
                name,
                subject,
                start_time,
                end_time,
                room,
                centres:centre_id (name),
                teachers:teacher_id (full_name, name),
                class_students (student_id)
              `)
              .eq('teacher_id', profile.teacher_id)
              .in('id', todayClassIds)
              .order('start_time')

            const coTeacherClassesPromise = coTeacherClassIds.length > 0
              ? supabase
                  .from('classes')
                  .select(`
                    id,
                    name,
                    subject,
                    start_time,
                    end_time,
                    room,
                    centres:centre_id (name),
                    teachers:teacher_id (full_name, name),
                    class_students (student_id)
                  `)
                  .in('id', coTeacherClassIds)
                  .order('start_time')
              : Promise.resolve({ data: [] as any[] })

            const [{ data: primaryClasses }, { data: coTeacherClasses }] = await Promise.all([
              primaryClassesPromise,
              coTeacherClassesPromise
            ])

            const combinedClasses = [...(primaryClasses || []), ...(coTeacherClasses || [])]
            const uniqueClasses = new Map(combinedClasses.map((c: any) => [c.id, c]))

            const formattedClasses = Array.from(uniqueClasses.values()).map((c: any) => ({
              id: c.id,
              name: c.name,
              subject: c.subject,
              start_time: c.start_time,
              end_time: c.end_time,
              room: c.room,
              centre_name: c.centres?.name || 'Unknown',
              teacher_name: getTeacherLabel(c.teachers),
              student_count: c.class_students?.length || 0
            }))
            setTodayClasses(formattedClasses)
          }
          
         // Fetch all classes for today (for admin view)
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
                teachers:teacher_id (full_name, name),
              class_students (student_id)
            `)
            .eq('organisation_id', profile.organisation_id)
            .in('id', todayClassIds)
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
              teacher_name: getTeacherLabel(c.teachers),
              student_count: c.class_students?.length || 0
            }))
            setAllClassesToday(formattedAllClasses)
          }
        } else {
          setTodayClasses([])
          setAllClassesToday([])
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

  useEffect(() => {
    if (!userProfile) return

    const isAdminUser = userProfile.has_admin_access || userProfile.is_super_admin
    const isTeacherUser = userProfile.teacher_id !== null

    if (isAdminUser && !isTeacherUser) {
      setDashboardView('admin')
    } else if (isTeacherUser && !isAdminUser) {
      setDashboardView('teacher')
    }
  }, [userProfile])

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

  const handleDeleteAnnouncement = async (announcementId: string) => {
    if (!isAdminView) return

    const confirmed = window.confirm('Delete this announcement? This action cannot be undone.')
    if (!confirmed) return

    setDeletingAnnouncementId(announcementId)
    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', announcementId)

      if (error) throw error

      setAnnouncements((prev) => prev.filter((announcement) => announcement.id !== announcementId))
    } catch (error) {
      console.error('Error deleting announcement:', error)
      alert('Failed to delete announcement')
    } finally {
      setDeletingAnnouncementId(null)
    }
  }

  const handleToggleAnnouncement = (announcementId: string) => {
    setExpandedAnnouncements((prev) => {
      const next = new Set(prev)
      if (next.has(announcementId)) {
        next.delete(announcementId)
      } else {
        next.add(announcementId)
      }
      return next
    })
  }

  if (loading) {
    return <div className="text-center py-12">Loading dashboard...</div>
  }

  const isAdmin = userProfile?.has_admin_access || userProfile?.is_super_admin
  const isTeacher = userProfile?.teacher_id !== null
  const isAdminView = Boolean(isAdmin && (!isTeacher || dashboardView === 'admin'))
  const isTeacherView = Boolean(isTeacher && (!isAdmin || dashboardView === 'teacher'))

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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline">
          <h1 className="text-lg font-bold leading-tight text-brand-primary sm:text-2xl">{dateString}</h1>
          {isAdminView && (
            <span className="text-sm text-gray-600">(Admin View - All Teachers)</span>
          )}
          {isTeacherView && (
            <span className="text-sm text-gray-600">(Teacher View - My Classes)</span>
          )}
        </div>
        {isAdmin && isTeacher && (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="text-xs text-gray-600 sm:text-sm">View:</span>
            <div className="flex w-full rounded-lg border border-gray-200 bg-white p-1 shadow-sm sm:inline-flex sm:w-auto">
              <button
                type="button"
                onClick={() => setDashboardView('admin')}
                aria-pressed={isAdminView}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors sm:flex-none sm:text-sm ${
                  isAdminView
                    ? 'bg-brand-primary text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => setDashboardView('teacher')}
                aria-pressed={isTeacherView}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors sm:flex-none sm:text-sm ${
                  isTeacherView
                    ? 'bg-brand-primary text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Teacher
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white shadow-lg rounded-xl border border-orange-100 p-4 sm:p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-brand-primary sm:text-2xl">
            Welcome, {userProfile?.full_name || 'User'}
          </h2>
          <p className="text-sm text-gray-600">
            {isAdminView ? 'Administrator' : isTeacherView ? 'Teacher' : 'User'} Dashboard
          </p>
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Quick actions</h3>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
            <Link
              href="/dashboard/schedules"
              className="flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm transition hover:border-brand-primary hover:text-brand-primary sm:text-sm"
            >
              View schedule
            </Link>
            <Link
              href="/dashboard/classes"
              className="flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm transition hover:border-brand-primary hover:text-brand-primary sm:text-sm"
            >
              Manage classes
            </Link>
            <Link
              href="/dashboard/profile"
              className="flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm transition hover:border-brand-primary hover:text-brand-primary sm:text-sm"
            >
              Profile settings
            </Link>
            {isAdminView && (
              <button
                type="button"
                onClick={() => setShowAnnouncementForm(true)}
                className="flex items-center justify-center rounded-lg border border-brand-primary bg-brand-primary px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-brand-primary-dark sm:text-sm"
              >
                Add announcement
              </button>
            )}
          </div>
        </div>

        {isAdminView && (
          <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
            <div className="bg-orange-50 rounded-xl p-4 sm:p-6 border border-orange-100">
              <h3 className="text-sm font-semibold text-brand-primary sm:text-lg">Centres</h3>
              <p className="text-2xl font-bold text-brand-primary sm:text-3xl">{stats.centres}</p>
              <p className="text-xs text-orange-700 sm:mt-2 sm:text-sm">Active centres</p>
            </div>

            <div className="bg-green-50 rounded-xl p-4 sm:p-6 border border-green-100">
              <h3 className="text-sm font-semibold text-brand-success sm:text-lg">Students</h3>
              <p className="text-2xl font-bold text-brand-success sm:text-3xl">{stats.students}</p>
              <p className="text-xs text-green-700 sm:mt-2 sm:text-sm">Enrolled students</p>
            </div>

            <div className="bg-blue-50 rounded-xl p-4 sm:p-6 border border-blue-100">
              <h3 className="text-sm font-semibold text-brand-secondary sm:text-lg">Teachers</h3>
              <p className="text-2xl font-bold text-brand-secondary sm:text-3xl">{stats.teachers}</p>
              <p className="text-xs text-blue-700 sm:mt-2 sm:text-sm">Active teachers</p>
            </div>

            <div className="bg-amber-50 rounded-xl p-4 sm:p-6 border border-amber-100">
              <h3 className="text-sm font-semibold text-brand-warning sm:text-lg">Classes</h3>
              <p className="text-2xl font-bold text-brand-warning sm:text-3xl">{stats.classes}</p>
              <p className="text-xs text-amber-700 sm:mt-2 sm:text-sm">Total classes</p>
            </div>
          </div>
        )}
            
      </div>

      {/* Announcements Section */}
      <div className="mt-6 bg-white shadow-lg rounded-xl border border-orange-100 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Announcements</h3>
            <p className="text-xs text-gray-500 sm:text-sm">Latest updates for your team</p>
          </div>
          {isAdminView && (
            <button
              onClick={() => setShowAnnouncementForm(!showAnnouncementForm)}
              className="flex w-full items-center justify-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark transition-colors text-sm font-medium sm:w-auto"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Announcement
            </button>
          )}
        </div>

        {isAdminView && showAnnouncementForm && (
          <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50 p-4">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={newAnnouncement.title}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                  placeholder="Enter announcement title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  value={newAnnouncement.message}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, message: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                  placeholder="Enter announcement message"
                />
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  onClick={() => {
                    setShowAnnouncementForm(false)
                    setNewAnnouncement({ title: '', message: '' })
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddAnnouncement}
                  disabled={savingAnnouncement || !newAnnouncement.title || !newAnnouncement.message}
                  className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-lg hover:bg-brand-primary-dark transition-colors disabled:opacity-50"
                >
                  {savingAnnouncement ? 'Posting...' : 'Post Announcement'}
                </button>
              </div>
            </div>
          </div>
        )}

        {announcements.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No announcements yet</p>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {announcements.map((announcement) => {
              const isLongMessage = announcement.message.length > 120
              const isExpanded = expandedAnnouncements.has(announcement.id)
              const messagePreview = isLongMessage && !isExpanded
                ? `${announcement.message.slice(0, 120)}…`
                : announcement.message

              return (
                <div key={announcement.id} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">{announcement.title}</h4>
                      <p className="text-sm text-gray-700 mb-2">{messagePreview}</p>
                      {isLongMessage && (
                        <button
                          type="button"
                          onClick={() => handleToggleAnnouncement(announcement.id)}
                          className="text-xs font-medium text-brand-primary hover:text-brand-primary-dark"
                        >
                          {isExpanded ? 'Show less' : 'Read more'}
                        </button>
                      )}
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>Posted by {announcement.author_name}</span>
                        <span>•</span>
                        <span>{new Date(announcement.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    </div>
                    {isAdminView && (
                      <button
                        type="button"
                        onClick={() => handleDeleteAnnouncement(announcement.id)}
                        disabled={deletingAnnouncementId === announcement.id}
                        className="ml-4 inline-flex items-center text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                      >
                        {deletingAnnouncementId === announcement.id ? 'Deleting...' : 'Delete'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {isTeacherView && (
        <div className="mt-6 bg-white shadow-lg rounded-xl border border-orange-100 p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">My Classes Today</h3>
          {todayClasses.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No classes scheduled for today</p>
          ) : (
            <div className="space-y-3">
              {todayClasses.map((cls) => (
              <div key={cls.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-brand-primary transition-colors">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{cls.name}</h4>
                      <div className="mt-2 grid gap-2 text-sm text-gray-600 sm:mt-1 sm:flex sm:flex-wrap sm:gap-3">
                        <span className="flex items-center">
                          <span className="font-medium text-brand-primary mr-1">Subject:</span>
                          {cls.subject}
                        </span>
                        <span className="flex items-center">
                          <span className="font-medium text-brand-secondary mr-1">Time:</span>
                          {cls.start_time} - {cls.end_time}
                        </span>
                        {cls.room && (
                          <span className="flex items-center">
                            <span className="font-medium text-brand-warning mr-1">Room:</span>
                            {cls.room}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 grid gap-2 text-sm sm:flex sm:flex-wrap sm:gap-3">
                        <span className="text-gray-600">
                          Centre: <span className="font-medium">{cls.centre_name}</span>
                        </span>
                        <span className="text-gray-600">
                          Teacher: <span className="font-medium">{cls.teacher_name}</span>
                        </span>
                        <span className="text-gray-600">
                          Students: <span className="font-medium text-brand-success">{cls.student_count}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isAdminView && (
        <div className="mt-6 bg-white shadow-lg rounded-xl border border-orange-100 p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">All Classes Today</h3>
          {allClassesToday.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No classes scheduled for today</p>
          ) : (
            <div className="space-y-3">
              {allClassesToday.map((cls) => (
              <div key={cls.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-brand-primary transition-colors">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{cls.name}</h4>
                      <div className="mt-2 grid gap-2 text-sm text-gray-600 sm:mt-1 sm:flex sm:flex-wrap sm:gap-3">
                        <span className="flex items-center">
                          <span className="font-medium text-brand-primary mr-1">Subject:</span>
                          {cls.subject}
                        </span>
                        <span className="flex items-center">
                          <span className="font-medium text-brand-secondary mr-1">Time:</span>
                          {cls.start_time} - {cls.end_time}
                        </span>
                        {cls.room && (
                          <span className="flex items-center">
                            <span className="font-medium text-brand-warning mr-1">Room:</span>
                            {cls.room}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 grid gap-2 text-sm sm:flex sm:flex-wrap sm:gap-3">
                        <span className="text-gray-600">
                          Centre: <span className="font-medium">{cls.centre_name}</span>
                        </span>
                        <span className="text-gray-600">
                          Teacher: <span className="font-medium">{cls.teacher_name}</span>
                        </span>
                        <span className="text-gray-600">
                          Students: <span className="font-medium text-brand-success">{cls.student_count}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
