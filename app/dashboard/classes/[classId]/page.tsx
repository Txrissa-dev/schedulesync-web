'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface ClassDetails {
  id: string
  name: string
  subject: string
  day_of_week: number
  start_time: string
  end_time: string
  room: string | null
  total_lessons: number | null
  teacher: { full_name: string } | null
  centre: { name: string } | null
}

interface LessonStatus {
  id: string
  class_id: string
  lesson_number: number
  scheduled_date: string
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled'
  attendance_record_id: string | null
  notes: string | null
}

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function ClassDetailsPage({ params }: { params: { classId: string } }) {
  const router = useRouter()
  const [classDetails, setClassDetails] = useState<ClassDetails | null>(null)
  const [lessons, setLessons] = useState<LessonStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLesson, setSelectedLesson] = useState<LessonStatus | null>(null)
  const [showLessonModal, setShowLessonModal] = useState(false)

  useEffect(() => {
    fetchClassData()
  }, [params.classId])

  const fetchClassData = async () => {
    try {
      // Fetch class details
      const { data: classData } = await supabase
        .from('classes')
        .select(`
          id,
          name,
          subject,
          day_of_week,
          start_time,
          end_time,
          room,
          total_lessons,
          teachers:teacher_id (full_name),
          centres:centre_id (name)
        `)
        .eq('id', params.classId)
        .single()

      if (classData) {
        setClassDetails({
          ...classData,
          teacher: classData.teachers,
          centre: classData.centres
        })
      }

      // Fetch lesson statuses
      const { data: lessonsData } = await supabase
        .from('lesson_statuses')
        .select('*')
        .eq('class_id', params.classId)
        .order('lesson_number', { ascending: true })

      if (lessonsData) {
        setLessons(lessonsData)
      }
    } catch (error) {
      console.error('Error fetching class data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLessonClick = (lesson: LessonStatus) => {
    setSelectedLesson(lesson)
    setShowLessonModal(true)
  }

  const handleMarkCompleted = async () => {
    if (!selectedLesson) return

    try {
      const { error } = await supabase
        .from('lesson_statuses')
        .update({ status: 'completed' })
        .eq('id', selectedLesson.id)

      if (error) throw error

      // Refresh data
      await fetchClassData()
      setShowLessonModal(false)
      setSelectedLesson(null)
    } catch (error) {
      console.error('Error marking lesson as completed:', error)
      alert('Failed to update lesson status')
    }
  }

  const handleMarkRescheduled = async () => {
    if (!selectedLesson) return

    try {
      const { error } = await supabase
        .from('lesson_statuses')
        .update({ status: 'rescheduled' })
        .eq('id', selectedLesson.id)

      if (error) throw error

      // Refresh data
      await fetchClassData()
      setShowLessonModal(false)
      setSelectedLesson(null)
    } catch (error) {
      console.error('Error marking lesson as rescheduled:', error)
      alert('Failed to update lesson status')
    }
  }

  const handleMarkAttendance = () => {
    if (!selectedLesson) return
    router.push(`/dashboard/classes/${params.classId}/attendance/${selectedLesson.id}`)
  }

  if (loading) {
    return <div className="text-center py-12">Loading class details...</div>
  }

  if (!classDetails) {
    return <div className="text-center py-12">Class not found</div>
  }

  const completedCount = lessons.filter(l => l.status === 'completed').length
  const totalLessons = classDetails.total_lessons || lessons.length
  const remainingCount = totalLessons - completedCount
  const progressPercent = totalLessons > 0 ? (completedCount / totalLessons) * 100 : 0

  return (
    <div className="px-4 py-6 sm:px-0 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => router.push('/dashboard/classes')}
          className="flex items-center gap-2 text-brand-primary font-medium hover:text-brand-primary-dark"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h2 className="text-lg font-semibold text-brand-primary">Class Details</h2>
        <button className="p-2 text-brand-secondary hover:text-brand-secondary-dark">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      </div>

      {/* Class Info Card */}
      <div className="bg-white shadow-lg rounded-2xl p-6 border-t-4 border-brand-primary">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{classDetails.name}</h1>
        <p className="text-lg text-gray-600 mb-6">{classDetails.subject}</p>

        <div className="space-y-3">
          <div className="flex items-center gap-3 text-gray-700">
            <div className="w-8 h-8 flex items-center justify-center bg-brand-primary bg-opacity-10 rounded-lg">
              <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="font-medium">{daysOfWeek[classDetails.day_of_week]}</span>
          </div>

          <div className="flex items-center gap-3 text-gray-700">
            <div className="w-8 h-8 flex items-center justify-center bg-brand-primary bg-opacity-10 rounded-lg">
              <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="font-medium">{classDetails.start_time} - {classDetails.end_time}</span>
          </div>

          <div className="flex items-center gap-3 text-gray-700">
            <div className="w-8 h-8 flex items-center justify-center bg-brand-primary bg-opacity-10 rounded-lg">
              <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span className="font-medium">{classDetails.centre?.name || 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lesson Progress Card */}
      {totalLessons > 0 && (
        <div className="bg-white shadow-lg rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">LESSON PROGRESS</h3>

          <div className="flex items-center gap-6 mb-6">
            <div className="text-5xl font-bold text-gray-900">
              {completedCount}<span className="text-gray-400">/{totalLessons}</span>
            </div>
            <p className="text-gray-600">{remainingCount} lessons remaining</p>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-3 mb-6">
            <div
              className="bg-brand-primary h-3 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <Link href={`/dashboard/classes/${params.classId}/report`}>
            <button className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-100 text-brand-primary font-medium rounded-lg hover:bg-gray-200 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              View Attendance Report
            </button>
          </Link>
        </div>
      )}

      {/* Lesson Schedule Card */}
      <div className="bg-white shadow-lg rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">LESSON SCHEDULE</h3>

        {lessons.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No lessons scheduled yet</p>
        ) : (
          <div className="space-y-3">
            {lessons.map((lesson) => {
              const lessonDate = new Date(lesson.scheduled_date)
              const today = new Date()
              today.setHours(0, 0, 0, 0)
              const isUpcoming = lessonDate >= today && lesson.status === 'scheduled'
              const isCompleted = lesson.status === 'completed'

              const formattedDate = `${MONTH_NAMES[lessonDate.getMonth()].slice(0, 3)} ${lessonDate.getDate()}, ${lessonDate.getFullYear()}`

              return (
                <button
                  key={lesson.id}
                  onClick={() => handleLessonClick(lesson)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all text-left ${
                    isCompleted
                      ? 'bg-green-50 hover:bg-green-100'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  {/* Lesson Number/Status Icon */}
                  <div
                    className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-semibold ${
                      isCompleted
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-300 text-gray-700'
                    }`}
                  >
                    {isCompleted ? (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span>{lesson.lesson_number}</span>
                    )}
                  </div>

                  {/* Lesson Info */}
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">Lesson {lesson.lesson_number}</h4>
                    <p className="text-sm text-gray-600">{formattedDate}</p>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium px-3 py-1 rounded-full ${
                        isCompleted
                          ? 'bg-green-100 text-green-700'
                          : isUpcoming
                          ? 'bg-gray-200 text-gray-700'
                          : lesson.status === 'cancelled'
                          ? 'bg-red-100 text-red-700'
                          : lesson.status === 'rescheduled'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {isCompleted ? 'Completed' : isUpcoming ? 'Upcoming' : lesson.status}
                    </span>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Lesson Action Modal */}
      {showLessonModal && selectedLesson && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">
              Lesson {selectedLesson.lesson_number}
            </h2>
            <p className="text-center text-gray-600 mb-6">
              {new Date(selectedLesson.scheduled_date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}
            </p>

            <div className="space-y-3">
              {/* Mark as Completed */}
              <button
                onClick={handleMarkCompleted}
                className="w-full flex items-center gap-4 p-4 bg-green-50 hover:bg-green-100 rounded-xl transition-colors text-left"
              >
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-green-700 text-lg">Mark as Completed</p>
                  <p className="text-sm text-gray-600">Lesson was conducted successfully</p>
                </div>
              </button>

              {/* Mark as Rescheduled */}
              <button
                onClick={handleMarkRescheduled}
                className="w-full flex items-center gap-4 p-4 bg-orange-50 hover:bg-orange-100 rounded-xl transition-colors text-left"
              >
                <div className="w-12 h-12 bg-brand-primary rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-brand-primary text-lg">Mark as Rescheduled</p>
                  <p className="text-sm text-gray-600">Lesson will be conducted on another date</p>
                </div>
              </button>

              {/* Mark Attendance */}
              <button
                onClick={handleMarkAttendance}
                className="w-full flex items-center gap-4 p-4 bg-orange-50 hover:bg-orange-100 rounded-xl transition-colors text-left"
              >
                <div className="w-12 h-12 bg-brand-primary rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-brand-primary text-lg">Mark Attendance</p>
                  <p className="text-sm text-gray-600">Record student attendance and notes</p>
                </div>
              </button>
            </div>

            {/* Cancel Button */}
            <button
              onClick={() => {
                setShowLessonModal(false)
                setSelectedLesson(null)
              }}
              className="w-full mt-6 py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
