'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface Class {
  id: string
  name: string
  subject: string
  day_of_week: number
  start_time: string
  end_time: string
  room: string | null
  teacher: {
    name: string
  } | null
  centre: {
    name: string
  } | null
  student_count: number
  total_lessons: number | null
}

interface Teacher {
  id: string
  name: string
  email: string | null
}

interface Centre {
  id: string
  name: string
}

interface Student {
  id: string
  name: string
}

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [organisationId, setOrganisationId] = useState<string | null>(null)

  // Add Class Modal States
  const [showAddClass, setShowAddClass] = useState(false)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [centres, setCentres] = useState<Centre[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [savingClass, setSavingClass] = useState(false)

  const [classForm, setClassForm] = useState({
    name: '',
    subject: '',
    teacher_id: '',
    centre_id: '',
    day_of_week: '',
    start_time: '',
    end_time: '',
    room: '',
    total_lessons: '',
  })
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Fetch user profile to get organisation_id
        const { data: profile } = await supabase
          .from('users')
          .select('organisation_id, teacher_id, has_admin_access, is_super_admin')
          .eq('auth_id', user.id)
          .single()

        if (!profile?.organisation_id) return

        setIsAdmin(profile.has_admin_access || profile.is_super_admin || false)
        setOrganisationId(profile.organisation_id)

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
            total_lessons,
            teachers:teacher_id (name),
            centres:centre_id (name),
            class_students (student_id)
          `)
          .eq('organisation_id', profile.organisation_id)

        // If user is a teacher (not admin), only show their classes
        if (profile.teacher_id && !profile.has_admin_access) {
          query = query.eq('teacher_id', profile.teacher_id)
        }

        const { data: classesData } = await query.order('day_of_week').order('start_time')

        if (classesData) {
          const formattedClasses = classesData.map((c: any) => ({
            id: c.id,
            name: c.name,
            subject: c.subject,
            day_of_week: c.day_of_week,
            start_time: c.start_time,
            end_time: c.end_time,
            room: c.room,
            total_lessons: c.total_lessons,
            teacher: c.teachers,
            centre: c.centres,
            student_count: c.class_students?.length || 0
          }))
          setClasses(formattedClasses)
        }

        // If admin, fetch teachers, centres, and students for the add form
        if (profile.has_admin_access || profile.is_super_admin) {
          // Fetch teachers
          const { data: teachersData } = await supabase
            .from('teachers')
            .select('id, name, email')
            .eq('organisation_id', profile.organisation_id)

          if (teachersData) setTeachers(teachersData)

          // Fetch centres
          const { data: centresData } = await supabase
            .from('centres')
            .select('id, name')
            .eq('organisation_id', profile.organisation_id)

          if (centresData) setCentres(centresData)

          // Fetch students
          const { data: studentsData } = await supabase
            .from('students')
            .select('id, name')
            .eq('organisation_id', profile.organisation_id)

          if (studentsData) setStudents(studentsData)
        }
      } catch (error) {
        console.error('Error fetching classes:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchClasses()
  }, [])

  const handleAddClass = async () => {
    if (!classForm.name || !classForm.subject || !classForm.teacher_id || !classForm.centre_id ||
        !classForm.day_of_week || !classForm.start_time || !classForm.end_time || !organisationId) {
      alert('Please fill in all required fields')
      return
    }

    if (selectedStudents.length === 0) {
      alert('Please select at least one student')
      return
    }

    setSavingClass(true)
    try {
      // 1. Create the class
      const { data: newClass, error: classError } = await supabase
        .from('classes')
        .insert({
          name: classForm.name,
          subject: classForm.subject,
          teacher_id: classForm.teacher_id,
          centre_id: classForm.centre_id,
          day_of_week: parseInt(classForm.day_of_week),
          start_time: classForm.start_time,
          end_time: classForm.end_time,
          room: classForm.room || null,
          total_lessons: classForm.total_lessons ? parseInt(classForm.total_lessons) : null,
          organisation_id: organisationId
        })
        .select()
        .single()

      if (classError) {
        console.error('Error creating class:', classError)
        alert(`Failed to create class: ${classError.message}`)
        return
      }

      // 2. Assign students to the class
      if (newClass && selectedStudents.length > 0) {
        const studentAssignments = selectedStudents.map(studentId => ({
          class_id: newClass.id,
          student_id: studentId
        }))

        const { error: studentsError } = await supabase
          .from('class_students')
          .insert(studentAssignments)

        if (studentsError) {
          console.error('Error assigning students:', studentsError)
          alert('Class created but failed to assign some students')
        }
      }

      // Refresh the classes list
      window.location.reload()

      alert('Class created successfully!')
      setShowAddClass(false)
      setClassForm({
        name: '',
        subject: '',
        teacher_id: '',
        centre_id: '',
        day_of_week: '',
        start_time: '',
        end_time: '',
        room: '',
        total_lessons: '',
      })
      setSelectedStudents([])
    } catch (error: any) {
      console.error('Error adding class:', error)
      alert(error.message || 'Failed to add class')
    } finally {
      setSavingClass(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading classes...</div>
  }

  // Group classes by day
  const classesByDay = classes.reduce((acc, cls) => {
    const day = daysOfWeek[cls.day_of_week]
    if (!acc[day]) acc[day] = []
    acc[day].push(cls)
    return acc
  }, {} as Record<string, Class[]>)

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-brand-primary">All Classes</h2>
          <p className="text-sm text-gray-600 mt-1">View and manage your classes</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddClass(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark transition-colors text-sm font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Class
          </button>
        )}
      </div>

      {classes.length === 0 ? (
        <div className="bg-white rounded-xl border border-orange-100 p-12 text-center">
          <p className="text-gray-500">No classes found.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(classesByDay).map(([day, dayClasses]) => (
            <div key={day} className="bg-white rounded-xl border border-orange-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{day}</h3>
              <div className="space-y-3">
                {dayClasses.map((cls) => (
                  <div
                    key={cls.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-brand-primary transition-colors"
                  >
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
                        {cls.centre && (
                          <span className="flex items-center">
                            <span className="font-medium text-gray-700 mr-1">Centre:</span>
                            {cls.centre.name}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-2 text-sm">
                        {cls.teacher && (
                          <span className="text-gray-600">
                            Teacher: <span className="font-medium">{cls.teacher.name}</span>
                          </span>
                        )}
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
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Class Modal */}
      {showAddClass && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add New Class</h3>
              <button
                onClick={() => setShowAddClass(false)}
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
                  value={classForm.name}
                  onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                  placeholder="e.g., Math 101"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
                <input
                  type="text"
                  value={classForm.subject}
                  onChange={(e) => setClassForm({ ...classForm, subject: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                  placeholder="e.g., Mathematics"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teacher *</label>
                  <select
                    value={classForm.teacher_id}
                    onChange={(e) => setClassForm({ ...classForm, teacher_id: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                  >
                    <option value="">Select Teacher</option>
                    {teachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Centre *</label>
                  <select
                    value={classForm.centre_id}
                    onChange={(e) => setClassForm({ ...classForm, centre_id: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                  >
                    <option value="">Select Centre</option>
                    {centres.map((centre) => (
                      <option key={centre.id} value={centre.id}>
                        {centre.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Day *</label>
                  <select
                    value={classForm.day_of_week}
                    onChange={(e) => setClassForm({ ...classForm, day_of_week: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                  >
                    <option value="">Select Day</option>
                    {daysOfWeek.map((day, index) => (
                      <option key={index} value={index}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time *</label>
                  <input
                    type="time"
                    value={classForm.start_time}
                    onChange={(e) => setClassForm({ ...classForm, start_time: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time *</label>
                  <input
                    type="time"
                    value={classForm.end_time}
                    onChange={(e) => setClassForm({ ...classForm, end_time: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
                  <input
                    type="text"
                    value={classForm.room}
                    onChange={(e) => setClassForm({ ...classForm, room: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                    placeholder="e.g., Room 101"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Number of Lessons</label>
                  <input
                    type="number"
                    value={classForm.total_lessons}
                    onChange={(e) => setClassForm({ ...classForm, total_lessons: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                    placeholder="e.g., 12"
                    min="1"
                  />
                </div>
              </div>

              {/* Students Selection */}
              <div className="pt-2 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assign Students * ({selectedStudents.length} selected)
                </label>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                  {students.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No students available</p>
                  ) : (
                    students.map((student) => (
                      <label
                        key={student.id}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(student.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStudents([...selectedStudents, student.id])
                            } else {
                              setSelectedStudents(selectedStudents.filter(id => id !== student.id))
                            }
                          }}
                          className="rounded border-gray-300 text-brand-primary focus:ring-brand-secondary"
                        />
                        <span className="text-sm text-gray-900">{student.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button
                  onClick={() => {
                    setShowAddClass(false)
                    setSelectedStudents([])
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddClass}
                  disabled={savingClass}
                  className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-lg hover:bg-brand-primary-dark transition-colors disabled:opacity-50"
                >
                  {savingClass ? 'Creating...' : 'Create Class'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
