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

interface Student {
  id: string
  name: string
  attendance_status: string
  attendance_notes: string
  attendance_id?: string
}

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function ClassDetailsPage({ params }: { params: { classId: string } }) {
  const router = useRouter()
  const [classDetails, setClassDetails] = useState<ClassDetails | null>(null)
  const [lessons, setLessons] = useState<LessonStatus[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)

  // Attendance modal state
  const [showAttendanceModal, setShowAttendanceModal] = useState(false)
  const [selectedLesson, setSelectedLesson] = useState<LessonStatus | null>(null)
  const [classNotes, setClassNotes] = useState('')
  const [savingAttendance, setSavingAttendance] = useState(false)

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

      // Fetch students in this class
      const { data: classStudents } = await supabase
        .from('class_students')
        .select('students:student_id (id, name)')
        .eq('class_id', params.classId)

      if (classStudents) {
        const studentsData = classStudents.map((cs: any) => ({
          id: cs.students.id,
          name: cs.students.name,
          attendance_status: 'present',
          attendance_notes: ''
        }))
        setStudents(studentsData)
      }
    } catch (error) {
      console.error('Error fetching class data:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateLessonStatus = async (lessonId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('lesson_statuses')
        .update({ status: newStatus })
        .eq('id', lessonId)

      if (error) throw error

      // Refresh lessons
      setLessons(lessons.map(l =>
        l.id === lessonId ? { ...l, status: newStatus as any } : l
      ))
    } catch (error) {
      console.error('Error updating lesson status:', error)
      alert('Failed to update lesson status')
    }
  }

  const openAttendanceModal = async (lesson: LessonStatus) => {
    setSelectedLesson(lesson)
    setClassNotes('')

    // If attendance already exists, load it
    if (lesson.attendance_record_id) {
      const { data: attendanceRecord } = await supabase
        .from('attendance_records')
        .select('teacher_notes')
        .eq('id', lesson.attendance_record_id)
        .single()

      if (attendanceRecord) {
        setClassNotes(attendanceRecord.teacher_notes || '')
      }

      // Load existing student attendance
      const { data: studentAttendance } = await supabase
        .from('student_attendance')
        .select('id, student_id, status, notes')
        .eq('attendance_record_id', lesson.attendance_record_id)

      const studentsWithAttendance = students.map(student => {
        const attendance = studentAttendance?.find(sa => sa.student_id === student.id)
        return {
          ...student,
          attendance_status: attendance?.status || 'present',
          attendance_notes: attendance?.notes || '',
          attendance_id: attendance?.id
        }
      })
      setStudents(studentsWithAttendance)
    }

    setShowAttendanceModal(true)
  }

  const updateStudentAttendance = (studentId: string, status: string) => {
    setStudents(students.map(s =>
      s.id === studentId ? { ...s, attendance_status: status } : s
    ))
  }

  const saveAttendance = async () => {
    if (!selectedLesson) return

    setSavingAttendance(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userProfile } = await supabase
        .from('users')
        .select('email')
        .eq('auth_id', user.id)
        .single()

      let attendanceRecordId = selectedLesson.attendance_record_id

      // Create or update attendance record
      if (!attendanceRecordId) {
        const { data: newRecord, error: recordError } = await supabase
          .from('attendance_records')
          .insert({
            class_id: params.classId,
            date: selectedLesson.scheduled_date,
            teacher_notes: classNotes,
            marked_by: userProfile?.email || user.email,
            marked_at: new Date().toISOString()
          })
          .select('id')
          .single()

        if (recordError) throw recordError
        attendanceRecordId = newRecord.id
      } else {
        await supabase
          .from('attendance_records')
          .update({
            teacher_notes: classNotes,
            marked_by: userProfile?.email || user.email,
            marked_at: new Date().toISOString()
          })
          .eq('id', attendanceRecordId)
      }

      // Save student attendance
      for (const student of students) {
        if (student.attendance_id) {
          await supabase
            .from('student_attendance')
            .update({
              status: student.attendance_status,
              notes: student.attendance_notes
            })
            .eq('id', student.attendance_id)
        } else {
          await supabase
            .from('student_attendance')
            .insert({
              attendance_record_id: attendanceRecordId,
              student_id: student.id,
              status: student.attendance_status,
              notes: student.attendance_notes
            })
        }
      }

      // Update lesson status to completed and link attendance record
      await supabase
        .from('lesson_statuses')
        .update({
          status: 'completed',
          attendance_record_id: attendanceRecordId
        })
        .eq('id', selectedLesson.id)

      alert('Attendance saved successfully!')
      setShowAttendanceModal(false)
      fetchClassData() // Refresh data
    } catch (error) {
      console.error('Error saving attendance:', error)
      alert('Failed to save attendance')
    } finally {
      setSavingAttendance(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading class details...</div>
  }

  if (!classDetails) {
    return <div className="text-center py-12">Class not found</div>
  }

  const completedCount = lessons.filter(l => l.status === 'completed').length
  const remainingCount = lessons.filter(l => l.status === 'scheduled').length
  const totalLessons = classDetails.total_lessons || lessons.length

  return (
    <div className="px-4 py-6 sm:px-0 space-y-6">
      {/* Class Header */}
      <div className="bg-white shadow-lg rounded-xl border border-orange-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-brand-primary">{classDetails.name}</h1>
          <Link
            href="/dashboard/classes"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Back to Classes
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Subject</p>
            <p className="font-semibold text-gray-900">{classDetails.subject}</p>
          </div>
          <div>
            <p className="text-gray-600">Day</p>
            <p className="font-semibold text-gray-900">{daysOfWeek[classDetails.day_of_week]}</p>
          </div>
          <div>
            <p className="text-gray-600">Time</p>
            <p className="font-semibold text-gray-900">{classDetails.start_time} - {classDetails.end_time}</p>
          </div>
          <div>
            <p className="text-gray-600">Centre</p>
            <p className="font-semibold text-gray-900">{classDetails.centre?.name || 'N/A'}</p>
          </div>
          {classDetails.teacher && (
            <div>
              <p className="text-gray-600">Teacher</p>
              <p className="font-semibold text-gray-900">{classDetails.teacher.full_name}</p>
            </div>
          )}
          {classDetails.room && (
            <div>
              <p className="text-gray-600">Room</p>
              <p className="font-semibold text-gray-900">{classDetails.room}</p>
            </div>
          )}
        </div>
      </div>

      {/* Lesson Progress */}
      {totalLessons > 0 && (
        <div className="bg-gradient-to-r from-brand-primary to-brand-secondary shadow-lg rounded-xl p-6 text-white">
          <h2 className="text-lg font-semibold mb-2">Lesson Progress</h2>
          <div className="flex items-center gap-4">
            <div className="text-5xl font-bold">{completedCount}/{totalLessons}</div>
            <div className="text-sm">
              <p className="opacity-90">{remainingCount} lessons remaining</p>
              <div className="w-48 bg-white bg-opacity-30 rounded-full h-2 mt-2">
                <div
                  className="bg-white h-2 rounded-full"
                  style={{ width: `${(completedCount / totalLessons) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lesson Schedule */}
      <div className="bg-white shadow-lg rounded-xl border border-orange-100 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Lesson Schedule</h2>

        {lessons.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No lessons scheduled yet</p>
        ) : (
          <div className="space-y-3">
            {lessons.map((lesson) => {
              const lessonDate = new Date(lesson.scheduled_date)
              const formattedDate = lessonDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              const today = new Date()
              today.setHours(0, 0, 0, 0)
              const isUpcoming = lessonDate >= today && lesson.status === 'scheduled'

              return (
                <div
                  key={lesson.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    lesson.status === 'completed'
                      ? 'bg-green-50 border-green-200'
                      : lesson.status === 'cancelled'
                      ? 'bg-red-50 border-red-200'
                      : lesson.status === 'rescheduled'
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-gray-900">
                          Lesson {lesson.lesson_number}
                        </h3>
                        <span className="text-sm text-gray-600">{formattedDate}</span>
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${
                            lesson.status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : lesson.status === 'cancelled'
                              ? 'bg-red-100 text-red-700'
                              : lesson.status === 'rescheduled'
                              ? 'bg-yellow-100 text-yellow-700'
                              : isUpcoming
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {lesson.status === 'scheduled' && isUpcoming ? 'Upcoming' : lesson.status}
                        </span>
                      </div>
                      {lesson.notes && (
                        <p className="text-sm text-gray-600 mt-1">{lesson.notes}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {lesson.status !== 'completed' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateLessonStatus(lesson.id, 'completed')}
                            className="px-3 py-1 text-sm font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200"
                          >
                            Mark Complete
                          </button>
                          <button
                            onClick={() => updateLessonStatus(lesson.id, 'cancelled')}
                            className="px-3 py-1 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => updateLessonStatus(lesson.id, 'rescheduled')}
                            className="px-3 py-1 text-sm font-medium text-yellow-700 bg-yellow-100 rounded-lg hover:bg-yellow-200"
                          >
                            Reschedule
                          </button>
                        </div>
                      )}
                      <button
                        onClick={() => openAttendanceModal(lesson)}
                        className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-lg hover:bg-brand-primary-dark"
                      >
                        {lesson.attendance_record_id ? 'Edit Attendance' : 'Mark Attendance'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Attendance Modal */}
      {showAttendanceModal && selectedLesson && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Mark Attendance</h3>
                <p className="text-sm text-gray-600">Lesson {selectedLesson.lesson_number} - {new Date(selectedLesson.scheduled_date).toLocaleDateString()}</p>
              </div>
              <button
                onClick={() => setShowAttendanceModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Student List */}
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Students</h4>
                {students.map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-900">{student.name}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateStudentAttendance(student.id, 'present')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium ${
                          student.attendance_status === 'present'
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        Present
                      </button>
                      <button
                        onClick={() => updateStudentAttendance(student.id, 'absent')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium ${
                          student.attendance_status === 'absent'
                            ? 'bg-red-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        Absent
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Class Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Class Notes
                </label>
                <textarea
                  value={classNotes}
                  onChange={(e) => setClassNotes(e.target.value)}
                  rows={4}
                  placeholder="Add notes about this lesson..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                />
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button
                  onClick={() => setShowAttendanceModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 border-2 border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveAttendance}
                  disabled={savingAttendance}
                  className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-lg hover:bg-brand-primary-dark disabled:opacity-50"
                >
                  {savingAttendance ? 'Saving...' : 'Save Attendance'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
