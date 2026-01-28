'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface ClassSchedule {
  id: string
  name: string
  subject: string
  day_of_week: number
  start_time: string
  end_time: string
  room: string | null
  centre_name: string
  teacher_name: string
  teacher_id: string | null
  student_count: number
  completed_lessons: number
  total_lessons: number | null
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const getTeacherLabel = (teacher: { full_name?: string | null; name?: string | null } | null) =>
  teacher?.full_name || teacher?.name || 'No teacher assigned'

export default function SchedulesPage() {
  const [classes, setClasses] = useState<ClassSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
  const [lessonsByDate, setLessonsByDate] = useState<Record<string, string[]>>({})
  const [viewMode, setViewMode] = useState<'admin' | 'teacher'>('admin')
  
  const getDateKey = (date: Date) => date.toLocaleDateString('en-CA')
   const getMonthRange = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const start = new Date(Date.UTC(year, month, 1))
    const end = new Date(Date.UTC(year, month + 1, 1))
    return { start: start.toISOString(), end: end.toISOString() }
  }
  const normalizeScheduledDate = (scheduledDate: string) =>
    scheduledDate.includes('T') ? scheduledDate.split('T')[0] : scheduledDate


  
  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Fetch user profile
        const { data: profile } = await supabase
          .from('users')
          .select('id, organisation_id, teacher_id, has_admin_access, is_super_admin')
          .eq('auth_id', user.id)
          .single()

        setUserProfile(profile)

        if (!profile?.organisation_id) return
        const isAdminProfile = profile?.has_admin_access || profile?.is_super_admin
        const useTeacherView = !isAdminProfile || viewMode === 'teacher'
        
        const classSelect = `
          id,
          name,
          subject,
          day_of_week,
          start_time,
          end_time,
          room,
          total_lessons,
          teacher_id,
          centres:centre_id (name),
          teachers:teacher_id (full_name, name),
          class_students (student_id)
        `

        const baseClassesQuery = () =>
          supabase
            .from('classes')
            .select(classSelect)
            .eq('organisation_id', profile.organisation_id)

        let classesData: any[] | null = null

        if (profile.teacher_id && useTeacherView) {
          const { data: primaryClasses } = await baseClassesQuery()
            .eq('teacher_id', profile.teacher_id)
            .order('start_time')

          const { data: coTeacherLessons } = await supabase
            .from('lesson_statuses')
            .select('class_id')
            .eq('co_teacher_id', profile.teacher_id)

          const coTeacherClassIds = Array.from(
            new Set(coTeacherLessons?.map((lesson) => lesson.class_id) ?? [])
          )

          let coTeacherClasses: any[] = []

          if (coTeacherClassIds.length > 0) {
            const { data: coClasses } = await baseClassesQuery()
              .in('id', coTeacherClassIds)
              .order('start_time')

            if (coClasses) {
              coTeacherClasses = coClasses
            }
          }

          const combinedClasses = [...(primaryClasses || []), ...coTeacherClasses]
          const uniqueClasses = new Map(combinedClasses.map((cls) => [cls.id, cls]))
          classesData = Array.from(uniqueClasses.values())
        } else {
          const { data } = await baseClassesQuery().order('start_time')
          classesData = data
        }

        if (classesData) {
          // Fetch lesson progress for each class
          const classesWithProgress = await Promise.all(
            classesData.map(async (c: any) => {
              const { data: lessons } = await supabase
                .from('lesson_statuses')
                .select('status')
                .eq('class_id', c.id)

              const completedLessons = lessons?.filter((l: any) => l.status === 'completed').length || 0

              return {
                id: c.id,
                name: c.name,
                subject: c.subject,
                day_of_week: c.day_of_week,
                start_time: c.start_time,
                end_time: c.end_time,
                room: c.room,
                centre_name: c.centres?.name || 'Unknown',
                teacher_name: getTeacherLabel(c.teachers),
                teacher_id: c.teacher_id,
                student_count: c.class_students?.length || 0,
                completed_lessons: completedLessons,
                total_lessons: c.total_lessons
              }
            })
          )
          setClasses(classesWithProgress)
        }
      } catch (error) {
        console.error('Error fetching schedules:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSchedules()
  }, [viewMode])

  useEffect(() => {
    const fetchLessonDates = async () => {
      if (classes.length === 0) {
        setLessonsByDate({})
        return
      }

      try {
        const { start: monthStartIso, end: monthEndIso } = getMonthRange(currentDate)
        const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
        const classIds = classes.map((cls) => cls.id)
        const isTeacherView = !userProfile?.has_admin_access && !userProfile?.is_super_admin
          ? true
          : viewMode === 'teacher'
        const primaryClassIds = userProfile?.teacher_id
          ? classes
              .filter((cls) => cls.teacher_id === userProfile.teacher_id)
              .map((cls) => cls.id)
          : classIds

        const lessonQueries = []

        if (!isTeacherView) {
          lessonQueries.push(
            supabase
              .from('lesson_statuses')
              .select('class_id, scheduled_date')
              .in('class_id', classIds)
              .gte('scheduled_date', monthStartIso)
              .lt('scheduled_date', monthEndIso)
          )
        } else {
          if (primaryClassIds.length > 0) {
            lessonQueries.push(
              supabase
                .from('lesson_statuses')
                .select('class_id, scheduled_date')
                .in('class_id', primaryClassIds)
                .neq('status', 'rescheduled')
                .gte('scheduled_date', monthStartIso)
                .lt('scheduled_date', monthEndIso)
            )
          }
          lessonQueries.push(
            supabase
              .from('lesson_statuses')
              .select('class_id, scheduled_date')
              .eq('co_teacher_id', userProfile.teacher_id)
              .neq('status', 'rescheduled')
              .gte('scheduled_date', monthStartIso)
              .lt('scheduled_date', monthEndIso)
          )
        }
        
        const results = await Promise.all(lessonQueries)
        const errors = results.find((result) => result.error)
        if (errors?.error) {
          console.error('Error fetching lesson dates:', errors.error)
          return
        }

        const groupedLessons: Record<string, string[]> = {}
        results.forEach((result) => {
          result.data?.forEach((lesson: any) => {
            const dateKey = normalizeScheduledDate(lesson.scheduled_date)
            if (!groupedLessons[dateKey]) {
              groupedLessons[dateKey] = []
            }
            groupedLessons[dateKey].push(lesson.class_id)
          })
        })

        setLessonsByDate(groupedLessons)
      } catch (error) {
        console.error('Error fetching lesson dates:', error)
      }
    }

    fetchLessonDates()
  }, [classes, currentDate, userProfile])
  
  // Generate calendar days for current month
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days: (Date | null)[] = []

    // Add empty slots for days before the first of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }

    return days
  }

  // Check if a date has classes
  const hasClassesOnDate = (date: Date) => {
    const dateKey = getDateKey(date)
    return Boolean(lessonsByDate[dateKey]?.length)
  }

  // Get classes for selected date
  const getClassesForDate = (date: Date) => {
    const dateKey = getDateKey(date)
    const classIds = lessonsByDate[dateKey]
    if (!classIds || classIds.length === 0) {
      return []
    }

    const classIdSet = new Set(classIds)
    return classes.filter(cls => classIdSet.has(cls.id))
  }

  // Navigate months
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
  }

  const isAdmin = userProfile?.has_admin_access || userProfile?.is_super_admin
  const canToggleView = isAdmin && userProfile?.teacher_id
  const isTeacherView = !isAdmin || viewMode === 'teacher'
  const calendarDays = getDaysInMonth(currentDate)
  const selectedDateClasses = selectedDate ? getClassesForDate(selectedDate) : []

    if (loading) {
    return (
      <div className="text-center py-12">Loading schedules...</div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Header */}
      <div className="mb-6">
        <p className="text-sm text-gray-600">Monthly View</p>
        <h1 className="text-4xl font-bold text-gray-900">
          {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h1>
        {isAdmin && (
          <p className="text-sm text-brand-primary mt-1">
            {isTeacherView ? 'Teacher View - My Classes' : 'Admin View - All Teachers'}
          </p>
        )}
        {canToggleView && (
          <div className="mt-3 inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1 text-sm">
            <button
              type="button"
              onClick={() => setViewMode('admin')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                viewMode === 'admin'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Admin view
            </button>
            <button
              type="button"
              onClick={() => setViewMode('teacher')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                viewMode === 'teacher'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Teacher view
            </button>
          </div>
        )}
      </div>

      {/* Calendar */}
      <div className="bg-white shadow-lg rounded-2xl p-6 mb-6">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={goToPreviousMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-lg font-semibold text-gray-900">
            {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <button
            onClick={goToNextMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Day headers */}
          {DAYS.map(day => (
            <div key={day} className="text-center font-medium text-gray-600 text-sm py-3">
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {calendarDays.map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} className="aspect-square" />
            }

            const hasClasses = hasClassesOnDate(date)
            const isSelected = selectedDate &&
              date.getDate() === selectedDate.getDate() &&
              date.getMonth() === selectedDate.getMonth() &&
              date.getFullYear() === selectedDate.getFullYear()
            const isToday =
              date.getDate() === new Date().getDate() &&
              date.getMonth() === new Date().getMonth() &&
              date.getFullYear() === new Date().getFullYear()

            return (
              <button
                key={index}
                onClick={() => setSelectedDate(date)}
                className={`
                  aspect-square p-2 rounded-xl transition-all relative
                  ${isSelected
                    ? 'bg-brand-secondary text-white'
                    : isToday
                    ? 'bg-blue-50 text-brand-secondary border-2 border-brand-secondary'
                    : 'hover:bg-gray-100'
                  }
                `}
              >
                <div className="flex flex-col items-center justify-center h-full">
                  <span className={`text-base font-medium ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                    {date.getDate()}
                  </span>
                  {hasClasses && (
                    <div className="flex gap-0.5 mt-1">
                      <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-green-500'}`} />
                      <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-green-500'}`} />
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Classes for selected date */}
      {selectedDate && (
        <div className="bg-white shadow-lg rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            {DAYS_FULL[selectedDate.getDay()].toUpperCase()}, {MONTH_NAMES[selectedDate.getMonth()].toUpperCase()} {selectedDate.getDate()}
          </h3>

          {selectedDateClasses.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No classes scheduled for this date</p>
          ) : (
            <div className="space-y-4">
              {selectedDateClasses.map((cls) => (
                <Link
                  key={cls.id}
                  href={`/dashboard/classes/${cls.id}`}
                  className="block"
                >
                  <div className="flex gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    {/* Time */}
                    <div className="flex-shrink-0 w-16 text-center">
                      <div className="text-lg font-bold text-gray-900">{cls.start_time.slice(0, 5)}</div>
                      <div className="text-xs text-gray-500">{cls.end_time.slice(0, 5)}</div>
                    </div>

                    {/* Class Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                        <h4 className="font-semibold text-gray-900">{cls.name}</h4>
                        <span className="text-sm text-gray-500">•</span>
                        <p className="text-sm text-brand-secondary">
                          Teacher: {cls.teacher_name}
                        </p>
                      </div>  
                      <p className="text-sm text-gray-600 mb-2">{cls.subject}</p>

                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span>{cls.centre_name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          <span>{cls.student_count}</span>
                        </div>
                      </div>
                    </div>

                    {/* Lesson Progress */}
                    {cls.total_lessons && (
                      <div className="flex-shrink-0 flex items-center">
                        <span className="text-sm font-medium text-green-600">
                          Lesson {cls.completed_lessons + 1}/{cls.total_lessons}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
