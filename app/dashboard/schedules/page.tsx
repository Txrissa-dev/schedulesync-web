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

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function SchedulesPage() {
  const [classes, setClasses] = useState<ClassSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay())
  const [userProfile, setUserProfile] = useState<any>(null)

  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Fetch user profile
        const { data: profile } = await supabase
          .from('users')
          .select('id, organisation_id, teacher_id, has_admin_access')
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
            teachers:teacher_id (name),
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
            teacher_name: c.teachers?.name || 'Unknown',
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

  if (loading) {
    return <div className="text-center py-12">Loading schedules...</div>
  }

  const filteredClasses = classes.filter(c => c.day_of_week === selectedDay)

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Class Schedules</h2>
          <Link
            href="/dashboard"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Back to Dashboard
          </Link>
        </div>

        {/* Day selector */}
        <div className="mb-6">
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {DAYS.map((day, index) => (
              <button
                key={day}
                onClick={() => setSelectedDay(index)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap transition ${
                  selectedDay === index
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        {/* Classes list */}
        {filteredClasses.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No classes scheduled for {DAYS[selectedDay]}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredClasses.map((cls) => (
              <div
                key={cls.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{cls.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{cls.subject}</p>
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Time:</span> {cls.start_time} - {cls.end_time}
                      </p>
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Location:</span> {cls.centre_name}
                        {cls.room && ` • Room ${cls.room}`}
                      </p>
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Teacher:</span> {cls.teacher_name}
                      </p>
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Students:</span> {cls.student_count}
                      </p>
                    </div>
                  </div>
                  <div className="ml-4">
                    <Link
                      href={`/dashboard/attendance/${cls.id}`}
                      className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                    >
                      View Attendance
                    </Link>
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
