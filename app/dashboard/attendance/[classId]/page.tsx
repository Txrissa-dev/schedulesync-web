'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Student {
  id: string
  name: string
  attendance_status?: string
  attendance_notes?: string
  attendance_id?: string
}

interface ClassInfo {
  name: string
  subject: string
  start_time: string
  end_time: string
}

export default function AttendancePage({ params }: { params: { classId: string } }) {
  const router = useRouter()
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [teacherNotes, setTeacherNotes] = useState('')
  const [attendanceRecordId, setAttendanceRecordId] = useState<string | null>(null)

  useEffect(() => {
    fetchAttendanceData()
  }, [params.classId, selectedDate])

  const fetchAttendanceData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch class info
      const { data: classData } = await supabase
        .from('classes')
        .select('name, subject, start_time, end_time')
        .eq('id', params.classId)
        .single()

      if (classData) {
        setClassInfo(classData)
      }

      // Fetch students in this class
      const { data: classStudents } = await supabase
        .from('class_students')
        .select('students:student_id (id, name)')
        .eq('class_id', params.classId)

      if (!classStudents) return

      // Check if attendance record exists for this date
      const { data: existingRecord } = await supabase
        .from('attendance_records')
        .select('id, teacher_notes')
        .eq('class_id', params.classId)
        .eq('date', selectedDate)
        .single()

      if (existingRecord) {
        setAttendanceRecordId(existingRecord.id)
        setTeacherNotes(existingRecord.teacher_notes || '')

        // Fetch existing student attendance
        const { data: studentAttendance } = await supabase
          .from('student_attendance')
          .select('id, student_id, status, notes')
          .eq('attendance_record_id', existingRecord.id)

        const studentsWithAttendance = classStudents.map((cs: any) => {
          const attendance = studentAttendance?.find(
            (sa: any) => sa.student_id === cs.students.id
          )
          return {
            id: cs.students.id,
            name: cs.students.name,
            attendance_status: attendance?.status || 'present',
            attendance_notes: attendance?.notes || '',
            attendance_id: attendance?.id
          }
        })

        setStudents(studentsWithAttendance)
      } else {
        // No existing record, set default attendance
        const studentsData = classStudents.map((cs: any) => ({
          id: cs.students.id,
          name: cs.students.name,
          attendance_status: 'present',
          attendance_notes: ''
        }))
        setStudents(studentsData)
      }
    } catch (error) {
      console.error('Error fetching attendance data:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateAttendanceStatus = (studentId: string, status: string) => {
    setStudents(students.map(s =>
      s.id === studentId ? { ...s, attendance_status: status } : s
    ))
  }

  const updateAttendanceNotes = (studentId: string, notes: string) => {
    setStudents(students.map(s =>
      s.id === studentId ? { ...s, attendance_notes: notes } : s
    ))
  }

  const handleSaveAttendance = async () => {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userProfile } = await supabase
        .from('users')
        .select('email')
        .eq('auth_id', user.id)
        .single()

      let recordId = attendanceRecordId

      // Create or update attendance record
      if (!recordId) {
        const { data: newRecord, error: recordError } = await supabase
          .from('attendance_records')
          .insert({
            class_id: params.classId,
            date: selectedDate,
            teacher_notes: teacherNotes,
            marked_by: userProfile?.email || user.email,
            marked_at: new Date().toISOString()
          })
          .select('id')
          .single()

        if (recordError) throw recordError
        recordId = newRecord.id
        setAttendanceRecordId(recordId)
      } else {
        await supabase
          .from('attendance_records')
          .update({
            teacher_notes: teacherNotes,
            marked_by: userProfile?.email || user.email,
            marked_at: new Date().toISOString()
          })
          .eq('id', recordId)
      }

      // Save student attendance
      for (const student of students) {
        if (student.attendance_id) {
          // Update existing
          await supabase
            .from('student_attendance')
            .update({
              status: student.attendance_status,
              notes: student.attendance_notes
            })
            .eq('id', student.attendance_id)
        } else {
          // Insert new
          await supabase
            .from('student_attendance')
            .insert({
              attendance_record_id: recordId,
              student_id: student.id,
              status: student.attendance_status,
              notes: student.attendance_notes
            })
        }
      }

      alert('Attendance saved successfully!')
      fetchAttendanceData() // Refresh data
    } catch (error) {
      console.error('Error saving attendance:', error)
      alert('Failed to save attendance. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading attendance...</div>
  }

  const presentCount = students.filter(s => s.attendance_status === 'present').length
  const absentCount = students.filter(s => s.attendance_status === 'absent').length
  const lateCount = students.filter(s => s.attendance_status === 'late').length

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{classInfo?.name}</h2>
            <p className="text-sm text-gray-600">
              {classInfo?.subject} • {classInfo?.start_time} - {classInfo?.end_time}
            </p>
          </div>
          <Link
            href="/dashboard/schedules"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Back to Schedules
          </Link>
        </div>

        {/* Date selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Date
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Attendance summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm text-green-700">Present</p>
            <p className="text-2xl font-bold text-green-600">{presentCount}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <p className="text-sm text-red-700">Absent</p>
            <p className="text-2xl font-bold text-red-600">{absentCount}</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4">
            <p className="text-sm text-yellow-700">Late</p>
            <p className="text-2xl font-bold text-yellow-600">{lateCount}</p>
          </div>
        </div>

        {/* Student attendance list */}
        <div className="space-y-4 mb-6">
          {students.map((student) => (
            <div key={student.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{student.name}</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => updateAttendanceStatus(student.id, 'present')}
                    className={`px-3 py-1 rounded text-sm ${
                      student.attendance_status === 'present'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    Present
                  </button>
                  <button
                    onClick={() => updateAttendanceStatus(student.id, 'absent')}
                    className={`px-3 py-1 rounded text-sm ${
                      student.attendance_status === 'absent'
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    Absent
                  </button>
                  <button
                    onClick={() => updateAttendanceStatus(student.id, 'late')}
                    className={`px-3 py-1 rounded text-sm ${
                      student.attendance_status === 'late'
                        ? 'bg-yellow-600 text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    Late
                  </button>
                </div>
              </div>
              <input
                type="text"
                placeholder="Add notes (optional)"
                value={student.attendance_notes}
                onChange={(e) => updateAttendanceNotes(student.id, e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
        </div>

        {/* Teacher notes */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Class Notes
          </label>
          <textarea
            value={teacherNotes}
            onChange={(e) => setTeacherNotes(e.target.value)}
            rows={3}
            placeholder="Add any notes about the class..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Save button */}
        <button
          onClick={handleSaveAttendance}
          disabled={saving}
          className="w-full px-4 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-300"
        >
          {saving ? 'Saving...' : 'Save Attendance'}
        </button>
      </div>
    </div>
  )
}
