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
    if (!isAdmin) return

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

        {isAdmin && (
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
        )}
            
      </div>

      {/* Announcements Section */}
      <div className="mt-6 bg-white shadow-lg rounded-xl border border-orange-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Announcements</h3>
          {isAdmin && (
            <button
              onClick={() => setShowAnnouncementForm(!showAnnouncementForm)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark transition-colors text-sm font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Announcement
            </button>
          )}
        </div>

        {isAdmin && showAnnouncementForm && (
          <div className="mb-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
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
              <div className="flex gap-2 justify-end">
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
          <div className="space-y-4">
            {announcements.map((announcement) => (
              <div key={announcement.id} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">{announcement.title}</h4>
                    <p className="text-sm text-gray-700 mb-2">{announcement.message}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>Posted by {announcement.author_name}</span>
                      <span>•</span>
                      <span>{new Date(announcement.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </div>
                  {isAdmin && (
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
            ))}
          </div>
        )}
      </div>

      {/* All Classes Today Section */}
      <div className="mt-6 bg-white shadow-lg rounded-xl border border-orange-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">All Classes Today</h3>
        {allClassesToday.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No classes scheduled for today</p>
        ) : (
          <div className="space-y-3">
            {allClassesToday.map((cls) => (
              <div key={cls.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-brand-primary transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{cls.name}</h4>
                    <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-600">
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
                    <div className="flex flex-wrap gap-3 mt-2 text-sm">
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
    </div>
  )
}
