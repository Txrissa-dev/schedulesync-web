'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Student {
  id: string
  name: string
  attendance_status?: 'present' | 'absent' | 'late' | 'excused' | 'prorated'
}

interface LessonDetails {
  id: string
  class_id: string
  lesson_number: number
  scheduled_date: string
  attendance_record_id?: string
}

const toStartOfDay = (date: Date) => {
  const normalized = new Date(date)
  normalized.setHours(0, 0, 0, 0)
  return normalized
}

export default function MarkAttendancePage({
  params
}: {
  params: { classId: string; lessonId: string }
}) {
  const router = useRouter()
  const [students, setStudents] = useState<Student[]>([])
  const [lessonDetails, setLessonDetails] = useState<LessonDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [teacherNotes, setTeacherNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchData()
  }, [params.classId, params.lessonId])

  const fetchData = async () => {
    try {
      // Fetch lesson details
      const { data: lesson } = await supabase
        .from('lesson_statuses')
        .select('*')
        .eq('id', params.lessonId)
        .single()

      if (lesson) {
        setLessonDetails(lesson)
      }

      // Fetch students enrolled in this class
      let classStudents: any[] | null = null
      const { data: classStudentsWithEnrolledAt, error: classStudentsError } = await supabase
        .from('class_students')
        .select(`
          student_id,
          students (id, name),
          enrolled_at
        `)
        .eq('class_id', params.classId)
      classStudents = classStudentsWithEnrolledAt

      if (classStudentsError?.code === 'PGRST204' && String(classStudentsError.message || '').includes('enrolled_at')) {
        const { data: classStudentsFallback, error: fallbackError } = await supabase
          .from('class_students')
          .select(`
            student_id,
            students (id, name)
          `)
          .eq('class_id', params.classId)
        if (fallbackError) throw fallbackError
        classStudents = classStudentsFallback
      } else if (classStudentsError) {
        throw classStudentsError
      }
      
      if (classStudents) {
        // Check if attendance record already exists
        let existingAttendance: any[] = []
        if (lesson?.attendance_record_id) {
          const { data: attendanceData } = await supabase
            .from('student_attendance')
            .select('student_id, status')
            .eq('attendance_record_id', lesson.attendance_record_id)

          if (attendanceData) {
            existingAttendance = attendanceData
          }

          // Fetch teacher notes
          const { data: recordData } = await supabase
            .from('attendance_records')
            .select('teacher_notes')
            .eq('id', lesson.attendance_record_id)
            .single()

          if (recordData?.teacher_notes) {
            setTeacherNotes(recordData.teacher_notes)
          }
        }

        const lessonDate = lesson?.scheduled_date
          ? toStartOfDay(new Date(`${lesson.scheduled_date}T00:00:00`))
          : null
        const studentsWithAttendance = classStudents.map((cs: any) => {
          const existingRecord = existingAttendance.find(a => a.student_id === cs.students.id)
          const enrolledAt = cs.enrolled_at ? toStartOfDay(new Date(cs.enrolled_at)) : null
          const defaultStatus =
            lessonDate && enrolledAt && lessonDate < enrolledAt ? 'prorated' : 'present'
          return {
            id: cs.students.id,
            name: cs.students.name,
            attendance_status: existingRecord?.status || defaultStatus
          }
        })

        setStudents(studentsWithAttendance)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ')
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase()
    }
    return parts.map(p => p[0]).join('').toUpperCase().substring(0, 4)
  }

  const toggleAttendance = (studentId: string) => {
    setStudents(students.map(student => {
      if (student.id === studentId) {
        const currentStatus = student.attendance_status || 'present'
        const nextStatus = currentStatus === 'present' ? 'absent' : 'present'
        return { ...student, attendance_status: nextStatus }
      }
      return student
    }))
  }

  const markAllPresent = () => {
    setStudents(students.map(student => ({
      ...student,
      attendance_status: 'present' as const
    })))
  }

  const handleSaveAttendance = async () => {
    if (!lessonDetails) return

    setSaving(true)
    try {
      let attendanceRecordId = lessonDetails.attendance_record_id

      // Create or update attendance record
      if (!attendanceRecordId) {
        const { data: newRecord, error: recordError } = await supabase
          .from('attendance_records')
          .insert({
            class_id: params.classId,
            date: lessonDetails.scheduled_date,
            teacher_notes: teacherNotes || null,
            marked_at: new Date().toISOString()
          })
          .select()
          .single()

        if (recordError) throw recordError
        attendanceRecordId = newRecord.id

        // Update lesson status with attendance record ID
        await supabase
          .from('lesson_statuses')
          .update({
            attendance_record_id: attendanceRecordId,
            status: 'completed'
          })
          .eq('id', params.lessonId)
      } else {
        // Update existing attendance record
        await supabase
          .from('attendance_records')
          .update({
            teacher_notes: teacherNotes || null,
            marked_at: new Date().toISOString()
          })
          .eq('id', attendanceRecordId)

        // Delete existing student attendance records
        await supabase
          .from('student_attendance')
          .delete()
          .eq('attendance_record_id', attendanceRecordId)
      }

      // Insert student attendance records
      const attendanceRecords = students.map(student => ({
        attendance_record_id: attendanceRecordId,
        student_id: student.id,
        status: student.attendance_status || 'present'
      }))

      const { error: attendanceError } = await supabase
        .from('student_attendance')
        .insert(attendanceRecords)

      if (attendanceError) throw attendanceError

      alert('Attendance saved successfully!')
      router.push(`/dashboard/classes/${params.classId}`)
    } catch (error) {
      console.error('Error saving attendance:', error)
      alert('Failed to save attendance')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  const presentCount = students.filter(s => s.attendance_status === 'present').length
  const absentCount = students.filter(s => s.attendance_status === 'absent').length
  const proratedCount = students.filter(s => s.attendance_status === 'prorated').length
  
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <h1 className="text-3xl font-bold text-center text-brand-primary mb-6">Mark Attendance</h1>

        {/* Info Banner */}
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <svg className="w-5 h-5 text-brand-primary flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-brand-primary">Tap student names to cycle through attendance status</p>
        </div>

        {/* Mark All Present Button */}
        <button
          onClick={markAllPresent}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white border-2 border-green-500 text-green-600 font-medium rounded-xl hover:bg-green-50 transition-colors mb-6"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
          Mark All Present
        </button>

        {/* Students List */}
        <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            STUDENTS ({students.length})
          </h2>

          <div className="space-y-3">
            {students.map((student) => (
              <button
                key={student.id}
                onClick={() => toggleAttendance(student.id)}
                className="w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-left"
              >
                {/* Student Initials */}
                <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-gray-700">{getInitials(student.name)}</span>
                </div>

                {/* Student Name */}
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{student.name}</p>
                </div>

                {/* Status Badge */}
                {student.attendance_status === 'present' ? (
                  <div className="flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1.5 rounded-full">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-medium text-sm">Present</span>
                  </div>
                ) : student.attendance_status === 'prorated' ? (
                  <div className="flex items-center gap-2 bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M18 12H6" />
                    </svg>
                    <span className="font-medium text-sm">Prorated</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-red-100 text-red-700 px-3 py-1.5 rounded-full">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="font-medium text-sm">Absent</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Class Notes */}
        <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">CLASS NOTES</h2>
          <textarea
            value={teacherNotes}
            onChange={(e) => setTeacherNotes(e.target.value)}
            placeholder="Add notes about today's class&#10;&#10;e.g., Lessons went well today. Emma left class early as her parents came earlier."
            className="w-full h-40 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-secondary resize-none text-gray-900"
          />
        </div>

        {/* Save Button */}
        <button
          onClick={handleSaveAttendance}
          disabled={saving}
          className="w-full py-4 bg-brand-primary text-white font-semibold text-lg rounded-xl hover:bg-brand-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          {saving ? 'Saving...' : 'Save Attendance'}
        </button>

        {/* Summary */}
        <div className="mt-4 text-center text-sm text-gray-600">
          <span className="font-medium text-green-600">{presentCount} Present</span>
          {' • '}
          <span className="font-medium text-red-600">{absentCount} Absent</span>
          {' • '}
          <span className="font-medium text-gray-600">{proratedCount} Prorated</span>
        </div>
      </div>
    </div>
  )
}
