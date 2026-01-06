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
  teacher_id: string | null
  centre_id: string | null
  organisation_id: string | null
  teacher: { name?: string | null; full_name?: string | null } | null
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
  co_teacher_id?: string | null
  co_teacher?: { name?: string | null; full_name?: string | null } | { name?: string | null; full_name?: string | null }[] | null
}

interface TeacherOption {
  id: string
  name?: string | null
  full_name?: string | null
  email?: string | null
  subjects?: string[] | null
}

interface CentreOption {
  id: string
  name: string
}

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const getTeacherLabel = (teacher: ClassDetails['teacher']) =>
  teacher?.full_name || teacher?.name || 'No teacher assigned'

const getTeacherName = (
  teacher?: { full_name?: string | null; name?: string | null } | { full_name?: string | null; name?: string | null }[] | null
) => {
  const normalized = Array.isArray(teacher) ? teacher[0] : teacher
  return normalized?.full_name || normalized?.name || 'No teacher assigned'
}

export default function ClassDetailsPage({ params }: { params: { classId: string } }) {
  const router = useRouter()
  const [classDetails, setClassDetails] = useState<ClassDetails | null>(null)
  const [lessons, setLessons] = useState<LessonStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLesson, setSelectedLesson] = useState<LessonStatus | null>(null)
  const [showLessonModal, setShowLessonModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [savingEdits, setSavingEdits] = useState(false)
  const [teachers, setTeachers] = useState<TeacherOption[]>([])
  const [centres, setCentres] = useState<CentreOption[]>([])
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([])
  const [newLessonDates, setNewLessonDates] = useState<string[]>([''])
  const [coTeacherAssignments, setCoTeacherAssignments] = useState([{ date: '', teacher_id: '' }])
  const [editForm, setEditForm] = useState({
    name: '',
    subject: '',
    teacher_id: '',
    centre_id: '',
    day_of_week: '',
    start_time: '',
    end_time: '',
    room: '',
    total_lessons: ''
  })
  
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
          teacher_id,
          centre_id,
          organisation_id,
          teachers:teacher_id (*),
          centres:centre_id (name)
        `)
        .eq('id', params.classId)
        .single()

      if (classData) {
        setClassDetails({
          ...classData,
          teacher: (classData.teachers as any)?.[0] || (classData.teachers as any) || null,
          centre: (classData.centres as any)?.[0] || (classData.centres as any) || null
        })
      }

      // Fetch lesson statuses
      const { data: lessonsData } = await supabase
        .from('lesson_statuses')
        .select('*, co_teacher:co_teacher_id (full_name, name)')
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

  useEffect(() => {
    if (!classDetails) return
    setEditForm({
      name: classDetails.name || '',
      subject: classDetails.subject || '',
      teacher_id: classDetails.teacher_id || '',
      centre_id: classDetails.centre_id || '',
      day_of_week: classDetails.day_of_week?.toString() || '',
      start_time: classDetails.start_time || '',
      end_time: classDetails.end_time || '',
      room: classDetails.room || '',
      total_lessons: classDetails.total_lessons?.toString() || ''
    })
    setNewLessonDates([''])
    setCoTeacherAssignments([{ date: '', teacher_id: '' }])
  }, [classDetails])

  useEffect(() => {
    const fetchOptions = async () => {
      if (!classDetails?.organisation_id) return
      const [{ data: teachersData }, { data: centresData }] = await Promise.all([
        supabase
          .from('teachers')
          .select('id, name, full_name, email, subjects')
          .eq('organisation_id', classDetails.organisation_id),
        supabase
          .from('centres')
          .select('id, name')
          .eq('organisation_id', classDetails.organisation_id)
      ])
      if (teachersData) setTeachers(teachersData)
      if (centresData) setCentres(centresData)
    }

    fetchOptions()
  }, [classDetails?.organisation_id])

  useEffect(() => {
    if (!editForm.teacher_id) {
      setAvailableSubjects([])
      return
    }
    const teacher = teachers.find(t => t.id === editForm.teacher_id)
    if (teacher?.subjects && Array.isArray(teacher.subjects)) {
      setAvailableSubjects(teacher.subjects)
    } else {
      setAvailableSubjects([])
    }
  }, [editForm.teacher_id, teachers])

  const handleTeacherChange = (teacherId: string) => {
    setEditForm(prev => ({ ...prev, teacher_id: teacherId, subject: '' }))
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

  const handleSaveEdits = async () => {
    if (!classDetails) return
    if (!editForm.name || !editForm.subject || !editForm.teacher_id || !editForm.centre_id ||
        !editForm.day_of_week || !editForm.start_time || !editForm.end_time) {
      alert('Please fill in all required fields')
      return
    }

    const cleanedLessonDates = newLessonDates
      .map(date => date.trim())
      .filter(Boolean)
    const cleanedCoTeacherAssignments = coTeacherAssignments
      .map((assignment) => ({ date: assignment.date.trim(), teacher_id: assignment.teacher_id }))
      .filter((assignment) => assignment.date && assignment.teacher_id)

    const existingLessonsCount = lessons.length
    const nextLessonNumber = lessons.reduce((max, lesson) => Math.max(max, lesson.lesson_number), 0) + 1
    const desiredTotalLessons = editForm.total_lessons ? parseInt(editForm.total_lessons) : null
    const minTotalLessons = existingLessonsCount + cleanedLessonDates.length
    const isReducingLessons = desiredTotalLessons !== null
      && cleanedLessonDates.length === 0
      && desiredTotalLessons < existingLessonsCount
    const completedLessonsOverLimit = isReducingLessons
      ? lessons.filter(lesson => lesson.status === 'completed' && lesson.lesson_number > desiredTotalLessons)
      : []
    const currentTotalLessons = classDetails.total_lessons ?? null
    const fallbackTotalLessons = cleanedLessonDates.length > 0 ? minTotalLessons : currentTotalLessons
    const totalLessonsToSave = desiredTotalLessons !== null
      ? cleanedLessonDates.length > 0
        ? Math.max(desiredTotalLessons, minTotalLessons)
        : desiredTotalLessons
      : fallbackTotalLessons

        if (completedLessonsOverLimit.length > 0) {
      alert('Total lessons cannot be less than completed lessons.')
      return
    }

    setSavingEdits(true)
    try {
      if (isReducingLessons) {
        const { error: deleteError } = await supabase
          .from('lesson_statuses')
          .delete()
          .eq('class_id', classDetails.id)
          .gt('lesson_number', desiredTotalLessons)
          .neq('status', 'completed')

        if (deleteError) throw deleteError
      }
      
      const { error: updateError } = await supabase
        .from('classes')
        .update({
          name: editForm.name,
          subject: editForm.subject,
          teacher_id: editForm.teacher_id,
          centre_id: editForm.centre_id,
          day_of_week: parseInt(editForm.day_of_week),
          start_time: editForm.start_time,
          end_time: editForm.end_time,
          room: editForm.room || null,
          total_lessons: totalLessonsToSave || null
        })
        .eq('id', classDetails.id)

      if (updateError) throw updateError

      if (cleanedLessonDates.length > 0) {
        const coTeacherByDate = new Map(
          cleanedCoTeacherAssignments.map((assignment) => [assignment.date, assignment.teacher_id])
        )  
        const newLessons = cleanedLessonDates.map((date, index) => ({
          class_id: classDetails.id,
          lesson_number: nextLessonNumber + index,
          scheduled_date: date,
          status: 'scheduled',
          notes: null,
          co_teacher_id: coTeacherByDate.get(date) || null
        }))

        const { error: lessonError } = await supabase
          .from('lesson_statuses')
          .insert(newLessons)

        if (lessonError) throw lessonError
      }

      if (cleanedCoTeacherAssignments.length > 0) {
        const updates = await Promise.all(
          cleanedCoTeacherAssignments.map((assignment) =>
            supabase
              .from('lesson_statuses')
              .update({ co_teacher_id: assignment.teacher_id })
              .eq('class_id', classDetails.id)
              .eq('scheduled_date', assignment.date)
          )
        )
        const updateError = updates.find((result) => result.error)?.error
        if (updateError) throw updateError
      }
      await fetchClassData()
      setShowEditModal(false)
      setNewLessonDates([''])
      setCoTeacherAssignments([{ date: '', teacher_id: '' }])
    } catch (error: any) {
      console.error('Error updating class:', error)
      const message = error?.message ? `Failed to update class details: ${error.message}` : 'Failed to update class details'
      alert(message)
    } finally {
      setSavingEdits(false)
    }
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
  const primaryTeacherName = getTeacherLabel(classDetails.teacher)
  const coTeacherNames = Array.from(
    new Set(
      lessons
        .map((lesson) => getTeacherName(lesson.co_teacher))
        .filter((name) => name !== 'No teacher assigned' && name !== primaryTeacherName)
    )
  )
  const teacherNames = coTeacherNames.length > 0
    ? `${primaryTeacherName} • ${coTeacherNames.join(', ')}`
    : primaryTeacherName
  
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
        <button
          onClick={() => setShowEditModal(true)}
          className="p-2 text-brand-secondary hover:text-brand-secondary-dark"
        >
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A9 9 0 1119 9a4 4 0 00-7.293 7.293M15 21H9a4 4 0 010-8h6a4 4 0 010 8z" />
              </svg>
            </div>
            <span className="font-medium">{teacherNames}</span>
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
                    {lesson.co_teacher && (
                      <p className="text-sm text-gray-500">
                        Co-teacher: {getTeacherName(lesson.co_teacher)}
                      </p>
                    )}            
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
            <p className="text-center text-sm text-gray-500 mb-4">
              Teacher: {primaryTeacherName}
              {selectedLesson.co_teacher ? ` • Co-teacher: ${getTeacherName(selectedLesson.co_teacher)}` : ''}
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

      {/* Edit Class Modal */}
      {showEditModal && classDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900">Edit Class Details</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class Name *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teacher *</label>
                <select
                  value={editForm.teacher_id}
                  onChange={(e) => handleTeacherChange(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                >
                  <option value="">Select a teacher</option>
                  {teachers.map((teacher) => {
                    const teacherLabel = teacher.full_name || teacher.name || teacher.email || 'Unnamed teacher'
                    const showEmail = teacher.email && teacherLabel !== teacher.email
                    return (
                      <option key={teacher.id} value={teacher.id}>
                        {teacherLabel} {showEmail ? `(${teacher.email})` : ''}
                      </option>
                    )
                  })}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
                <select
                  value={editForm.subject}
                  onChange={(e) => setEditForm(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary disabled:bg-gray-100 disabled:cursor-not-allowed"
                  disabled={!editForm.teacher_id || availableSubjects.length === 0}
                >
                  <option value="">
                    {!editForm.teacher_id
                      ? 'Select a teacher first'
                      : availableSubjects.length === 0
                      ? 'No subjects available'
                      : 'Select a subject'}
                  </option>
                  {availableSubjects.map((subject, index) => (
                    <option key={index} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Centre *</label>
                <select
                  value={editForm.centre_id}
                  onChange={(e) => setEditForm(prev => ({ ...prev, centre_id: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                >
                  <option value="">Select a centre</option>
                  {centres.map((centre) => (
                    <option key={centre.id} value={centre.id}>
                      {centre.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Day of Week *</label>
                  <select
                    value={editForm.day_of_week}
                    onChange={(e) => setEditForm(prev => ({ ...prev, day_of_week: e.target.value }))}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                  >
                    <option value="">Select day</option>
                    {daysOfWeek.map((day, index) => (
                      <option key={day} value={index}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Lessons</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.total_lessons}
                    onChange={(e) => setEditForm(prev => ({ ...prev, total_lessons: e.target.value }))}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time *</label>
                  <input
                    type="time"
                    value={editForm.start_time}
                    onChange={(e) => setEditForm(prev => ({ ...prev, start_time: e.target.value }))}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time *</label>
                  <input
                    type="time"
                    value={editForm.end_time}
                    onChange={(e) => setEditForm(prev => ({ ...prev, end_time: e.target.value }))}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
                <input
                  type="text"
                  value={editForm.room}
                  onChange={(e) => setEditForm(prev => ({ ...prev, room: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                />
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-700">Add Lesson Dates</h4>
                  <button
                    type="button"
                    onClick={() => setNewLessonDates(prev => [...prev, ''])}
                    className="text-sm text-brand-primary font-medium hover:text-brand-primary-dark"
                  >
                    + Add date
                  </button>
                </div>

                <div className="space-y-2">
                  {newLessonDates.map((date, index) => (
                    <div key={`${index}-${date}`} className="flex items-center gap-2">
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => {
                          const updated = [...newLessonDates]
                          updated[index] = e.target.value
                          setNewLessonDates(updated)
                        }}
                        className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                      />
                      {newLessonDates.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setNewLessonDates(prev => prev.filter((_, idx) => idx !== index))}
                          className="px-3 py-2 text-sm text-gray-500 hover:text-red-600"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  New dates will be added to the schedule in the next available lesson slots.
                </p>
              </div>
            </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-700">Assign Co-teachers</h4>
                  <button
                    type="button"
                    onClick={() => setCoTeacherAssignments((prev) => [...prev, { date: '', teacher_id: '' }])}
                    className="text-sm text-brand-primary font-medium hover:text-brand-primary-dark"
                  >
                    + Add co-teacher
                  </button>
                </div>

                <div className="space-y-2">
                  {coTeacherAssignments.map((assignment, index) => (
                    <div key={`${assignment.date}-${index}`} className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={assignment.date}
                        onChange={(e) => {
                          const updated = [...coTeacherAssignments]
                          updated[index] = { ...updated[index], date: e.target.value }
                          setCoTeacherAssignments(updated)
                        }}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                      />
                      <select
                        value={assignment.teacher_id}
                        onChange={(e) => {
                          const updated = [...coTeacherAssignments]
                          updated[index] = { ...updated[index], teacher_id: e.target.value }
                          setCoTeacherAssignments(updated)
                        }}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                      >
                        <option value="">Select co-teacher</option>
                        {teachers
                          .filter((teacher) => teacher.id !== editForm.teacher_id)
                          .map((teacher) => {
                            const teacherLabel = teacher.full_name || teacher.name || teacher.email || 'Unnamed teacher'
                            const showEmail = teacher.email && teacherLabel !== teacher.email
                            return (
                              <option key={teacher.id} value={teacher.id}>
                                {teacherLabel} {showEmail ? `(${teacher.email})` : ''}
                              </option>
                            )
                          })}
                      </select>
                      {coTeacherAssignments.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setCoTeacherAssignments((prev) => prev.filter((_, idx) => idx !== index))
                          }
                          className="md:col-span-2 text-left text-sm text-gray-500 hover:text-red-600"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Select lesson dates to add or update co-teachers.
                </p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                disabled={savingEdits}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdits}
                className="px-6 py-2 bg-brand-primary text-white rounded-lg font-medium hover:bg-brand-primary-dark disabled:opacity-60"
                disabled={savingEdits}
              >
                {savingEdits ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
