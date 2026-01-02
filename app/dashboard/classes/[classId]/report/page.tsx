'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface ClassInfo {
  id: string
  name: string
  subject: string
  teacher_name: string
  centre_name: string
  student_count: number
  completed_lessons: number
}

interface AttendanceRecord {
  date: string
  lesson_number: number
  students: {
    [studentId: string]: 'present' | 'absent' | 'late' | 'excused'
  }
}

interface StudentSummary {
  id: string
  name: string
  attendance: { [date: string]: 'present' | 'absent' | 'late' | 'excused' }
  totalPresent: number
}

export default function AttendanceReportPage({ params }: { params: { classId: string } }) {
  const router = useRouter()
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null)
  const [students, setStudents] = useState<StudentSummary[]>([])
  const [lessonDates, setLessonDates] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReportData()
  }, [params.classId])

  const fetchReportData = async () => {
    try {
      // Fetch class details
      const { data: classData } = await supabase
        .from('classes')
        .select(`
          id,
          name,
          subject,
          teachers:teacher_id (full_name),
          centres:centre_id (name)
        `)
        .eq('id', params.classId)
        .single()

      // Fetch all students in class
      const { data: classStudents } = await supabase
        .from('class_students')
        .select(`
          students (id, name)
        `)
        .eq('class_id', params.classId)

      // Fetch completed lessons with attendance
      const { data: lessons } = await supabase
        .from('lesson_statuses')
        .select('*, attendance_records(*)')
        .eq('class_id', params.classId)
        .eq('status', 'completed')
        .not('attendance_record_id', 'is', null)
        .order('scheduled_date', { ascending: true })

      if (!classData || !classStudents || !lessons) return

      // Build student summary
      const studentMap: { [id: string]: StudentSummary } = {}
      classStudents.forEach((cs: any) => {
        studentMap[cs.students.id] = {
          id: cs.students.id,
          name: cs.students.name,
          attendance: {},
          totalPresent: 0
        }
      })

      // Process attendance for each lesson
      const dates: string[] = []
      for (const lesson of lessons) {
        if (!lesson.attendance_records) continue

        const dateKey = new Date(lesson.scheduled_date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        })
        dates.push(dateKey)

        // Fetch student attendance for this lesson
        const { data: studentAttendance } = await supabase
          .from('student_attendance')
          .select('*')
          .eq('attendance_record_id', lesson.attendance_records.id)

        if (studentAttendance) {
          studentAttendance.forEach((sa: any) => {
            if (studentMap[sa.student_id]) {
              studentMap[sa.student_id].attendance[dateKey] = sa.status
              if (sa.status === 'present') {
                studentMap[sa.student_id].totalPresent++
              }
            }
          })
        }
      }

      setClassInfo({
        id: classData.id,
        name: classData.name,
        subject: classData.subject,
        teacher_name: (classData.teachers as any)?.[0]?.full_name || (classData.teachers as any)?.full_name || 'Unknown',
        centre_name: (classData.centres as any)?.[0]?.name || (classData.centres as any)?.name || 'Unknown',
        student_count: classStudents.length,
        completed_lessons: lessons.length
      })

      setLessonDates(dates)
      setStudents(Object.values(studentMap))
    } catch (error) {
      console.error('Error fetching report data:', error)
    } finally {
      setLoading(false)
    }
  }

  const downloadCSV = () => {
    if (!classInfo || students.length === 0) return

    // Build CSV content
    let csv = 'Student,' + lessonDates.join(',') + ',Total\n'

    students.forEach(student => {
      const row = [student.name]
      lessonDates.forEach(date => {
        const status = student.attendance[date]
        row.push(status === 'present' ? 'P' : status === 'absent' ? 'A' : '-')
      })
      row.push(student.totalPresent.toString())
      csv += row.join(',') + '\n'
    })

    // Create download link
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${classInfo.name}_attendance_report.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="text-center py-12">Loading report...</div>
  }

  if (!classInfo) {
    return <div className="text-center py-12">Class not found</div>
  }

  const totalPresent = students.reduce((sum, s) => sum + s.totalPresent, 0)
  const totalAbsent = students.length * lessonDates.length - totalPresent
  const totalMarked = students.length * lessonDates.length
  const expectedTotal = students.length * lessonDates.length

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.push(`/dashboard/classes/${params.classId}`)}
            className="flex items-center gap-2 text-brand-primary font-medium hover:text-brand-primary-dark"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-2xl font-bold text-brand-primary">Attendance Report</h1>
          <div className="w-20"></div>
        </div>

        {/* Class Information */}
        <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">CLASS INFORMATION</h2>

          <h3 className="text-2xl font-bold text-gray-900 mb-2">{classInfo.name}</h3>
          <p className="text-gray-600 mb-4">{classInfo.subject}</p>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 text-gray-700">
              <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>{classInfo.teacher_name}</span>
            </div>

            <div className="flex items-center gap-2 text-gray-700">
              <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span>{classInfo.centre_name}</span>
            </div>

            <div className="flex items-center gap-2 text-gray-700">
              <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>{classInfo.student_count} Students</span>
            </div>

            <div className="flex items-center gap-2 text-gray-700">
              <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <span>{classInfo.completed_lessons} Lessons</span>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">LEGEND</h2>

          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center">
                <span className="text-white font-bold text-sm">P</span>
              </div>
              <span className="text-gray-700">Present</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-300 rounded flex items-center justify-center">
                <span className="text-gray-700 font-bold text-sm">A</span>
              </div>
              <span className="text-gray-700">Absent</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-600 rounded flex items-center justify-center">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <span className="text-gray-700">Absent (Prorated)</span>
            </div>
          </div>
        </div>

        {/* Attendance Record Table */}
        {lessonDates.length > 0 ? (
          <div className="bg-white rounded-2xl p-6 shadow-lg mb-6 overflow-x-auto">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">ATTENDANCE RECORD</h2>

            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-2 text-sm font-semibold text-gray-600">Student</th>
                  {lessonDates.map((date, i) => (
                    <th key={i} className="text-center py-3 px-2 text-sm font-semibold text-gray-600">{date}</th>
                  ))}
                  <th className="text-center py-3 px-2 text-sm font-semibold text-brand-primary">Total</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} className="border-b border-gray-100">
                    <td className="py-3 px-2 text-sm font-medium text-gray-900">{student.name}</td>
                    {lessonDates.map((date, i) => {
                      const status = student.attendance[date]
                      return (
                        <td key={i} className="py-3 px-2 text-center">
                          <div className={`w-8 h-8 mx-auto rounded flex items-center justify-center ${
                            status === 'present'
                              ? 'bg-green-500'
                              : status === 'absent'
                              ? 'bg-gray-300'
                              : 'bg-white'
                          }`}>
                            <span className={`font-bold text-sm ${
                              status === 'present'
                                ? 'text-white'
                                : status === 'absent'
                                ? 'text-gray-700'
                                : 'text-gray-400'
                            }`}>
                              {status === 'present' ? 'P' : status === 'absent' ? 'A' : '-'}
                            </span>
                          </div>
                        </td>
                      )
                    })}
                    <td className="py-3 px-2 text-center">
                      <span className="text-brand-primary font-bold">{student.totalPresent}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
            <p className="text-center text-gray-500">No attendance records yet</p>
          </div>
        )}

        {/* Summary */}
        {lessonDates.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">SUMMARY</h2>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                  <span className="text-gray-700">Total Product Count (P)</span>
                </div>
                <span className="text-2xl font-bold text-green-600">{totalPresent}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-400 rounded-full"></div>
                  <span className="text-gray-700">Total Absent (A)</span>
                </div>
                <span className="text-2xl font-bold text-gray-600">{totalAbsent}</span>
              </div>

              <div className="border-t-2 border-gray-200 pt-3 mt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-700 font-medium">Total Marked</span>
                  <span className="text-2xl font-bold text-gray-900">{totalMarked}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-700 font-medium">Expected Total</span>
                  <span className="text-2xl font-bold text-gray-900">{expectedTotal}</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500 text-center mt-4">
              Report generated on {new Date().toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })} at {new Date().toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              })}
            </p>
          </div>
        )}

        {/* Download Button */}
        <button
          onClick={downloadCSV}
          disabled={lessonDates.length === 0}
          className="w-full py-4 bg-brand-primary text-white font-semibold text-lg rounded-xl hover:bg-brand-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download as Excel (CSV)
        </button>
      </div>
    </div>
  )
}
