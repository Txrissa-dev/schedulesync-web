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
  student_count: number
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function SchedulesPage() {
  const [classes, setClasses] = useState<ClassSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())

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

        // Build query based on user role
        let query = supabase
          .from('classes')
          .select(`
            id,
            name,
            subject,
            day_of_week,
            start_time,
            end_time,
            room,
            centres:centre_id (name),
            teachers:teacher_id (full_name),
            class_students (student_id)
          `)
          .eq('organisation_id', profile.organisation_id)

        // If teacher, only show their classes
        if (profile.teacher_id && !profile.has_admin_access) {
          query = query.eq('teacher_id', profile.teacher_id)
        }

        const { data: classesData } = await query.order('start_time')

        if (classesData) {
          const formatted = classesData.map((c: any) => ({
            id: c.id,
            name: c.name,
            subject: c.subject,
            day_of_week: c.day_of_week,
            start_time: c.start_time,
            end_time: c.end_time,
            room: c.room,
            centre_name: c.centres?.name || 'Unknown',
            teacher_name: c.teachers?.full_name || 'Unknown',
            student_count: c.class_students?.length || 0
          }))
          setClasses(formatted)
        }
      } catch (error) {
        console.error('Error fetching schedules:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSchedules()
  }, [])

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
    const dayOfWeek = date.getDay()
    return classes.some(cls => cls.day_of_week === dayOfWeek)
  }

  // Get classes for selected date
  const getClassesForDate = (date: Date) => {
    const dayOfWeek = date.getDay()
    return classes.filter(cls => cls.day_of_week === dayOfWeek)
  }

  // Navigate months
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
  }

  if (loading) {
    return <div className="text-center py-12">Loading schedules...</div>
  }

  const isAdmin = userProfile?.has_admin_access || userProfile?.is_super_admin
  const calendarDays = getDaysInMonth(currentDate)
  const selectedDateClasses = selectedDate ? getClassesForDate(selectedDate) : []

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-baseline gap-2">
          <h1 className="text-2xl font-bold text-brand-primary">Monthly View</h1>
          <span className="text-xl text-gray-700">
            {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
          </span>
        </div>
        {isAdmin && (
          <p className="text-sm text-gray-600 mt-1">Admin View - All Teachers</p>
        )}
      </div>

      {/* Calendar */}
      <div className="bg-white shadow-lg rounded-xl border border-orange-100 p-6 mb-6">
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
        <div className="grid grid-cols-7 gap-2">
          {/* Day headers */}
          {DAYS.map(day => (
            <div key={day} className="text-center font-semibold text-gray-600 text-sm py-2">
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
                  aspect-square p-2 rounded-lg border-2 transition-all
                  ${isSelected
                    ? 'border-brand-primary bg-orange-50'
                    : isToday
                    ? 'border-brand-secondary bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }
                `}
              >
                <div className="flex flex-col items-center justify-center h-full">
                  <span className={`text-sm ${isSelected ? 'font-bold text-brand-primary' : 'text-gray-700'}`}>
                    {date.getDate()}
                  </span>
                  {hasClasses && (
                    <div className={`w-1.5 h-1.5 rounded-full mt-1 ${isSelected ? 'bg-brand-primary' : 'bg-brand-secondary'}`} />
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Classes for selected date */}
      {selectedDate && (
        <div className="bg-white shadow-lg rounded-xl border border-orange-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Classes on {MONTH_NAMES[selectedDate.getMonth()]} {selectedDate.getDate()}, {selectedDate.getFullYear()}
          </h3>

          {selectedDateClasses.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No classes scheduled for this date</p>
          ) : (
            <div className="space-y-3">
              {selectedDateClasses.map((cls) => (
                <div
                  key={cls.id}
                  className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-brand-primary transition-colors"
                >
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
                    <Link
                      href={`/dashboard/attendance/${cls.id}`}
                      className="ml-4 px-4 py-2 bg-brand-success text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors"
                    >
                      Attendance
                    </Link>
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
