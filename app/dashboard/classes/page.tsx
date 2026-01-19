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
    name?: string | null
    full_name?: string | null
  } | null
  centre: {
    name: string
  } | null
  student_count: number
  total_lessons: number | null
  effective_total_lessons: number
  completed_lessons: number
}

interface Teacher {
  id: string
  name?: string | null
  full_name?: string | null
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

interface UserProfile {
  organisation_id: string | null
  has_admin_access: boolean
  is_super_admin: boolean
  teacher_id: string | null
}

interface LessonRecord {
  class_id: string
  lesson_number: number
  scheduled_date: string
  status: 'scheduled'
  notes: null
  co_teacher_id: string | null
}

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const daysOfWeekShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const getTeacherLabel = (teacher: Class['teacher']) =>
  teacher?.full_name || teacher?.name || 'No teacher assigned'

export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [organisationId, setOrganisationId] = useState<string | null>(null)
 const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [classView, setClassView] = useState<'admin' | 'teacher'>('admin')
  const [collapsedTeachers, setCollapsedTeachers] = useState<Record<string, boolean>>({})
  
  // Add Class Modal States
  const [showAddClass, setShowAddClass] = useState(false)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [centres, setCentres] = useState<Centre[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [savingClass, setSavingClass] = useState(false)

  const [classForm, setClassForm] = useState({
    teacher_id: '',
    subject: '',
    centre_id: '',
    day_of_week: '',
    start_time: '',
    end_time: '',
    name: '',
    room: '',
    total_lessons: '',
    start_date: '',
  })
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([])
  const [studentSearchQuery, setStudentSearchQuery] = useState('')
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([])
  const [coTeacherAssignments, setCoTeacherAssignments] = useState([{ date: '', teacher_id: '' }])
  
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        setLoading(true)
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
        setUserProfile(profile)

        const isAdminUser = profile.has_admin_access || profile.is_super_admin
        const isTeacherUser = Boolean(profile.teacher_id)
        const isAdminView = isAdminUser && (!isTeacherUser || classView === 'admin')
        const isTeacherView = isTeacherUser && (!isAdminUser || classView === 'teacher')
        
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
            teachers:teacher_id (*),
            centres:centre_id (name),
            class_students (student_id)
          `)
          .eq('organisation_id', profile.organisation_id)

        // If viewing as teacher, only show their classes
        if (profile.teacher_id && isTeacherView) {
          query = query.eq('teacher_id', profile.teacher_id)
        }

        const { data: classesData } = await query.order('subject').order('name')

        if (classesData) {
          // Fetch lesson progress for each class
          const classesWithProgress = await Promise.all(
            classesData.map(async (c: any) => {
              const { data: lessons } = await supabase
                .from('lesson_statuses')
                .select('status')
                .eq('class_id', c.id)

              const completedLessons = lessons?.filter((l: any) => l.status === 'completed').length || 0
              const rescheduledLessons = lessons?.filter((l: any) => l.status === 'rescheduled').length || 0
              const effectiveTotalLessons = Math.max((c.total_lessons || 0) - rescheduledLessons, 0)
              
              return {
                id: c.id,
                name: c.name,
                subject: c.subject,
                day_of_week: c.day_of_week,
                start_time: c.start_time,
                end_time: c.end_time,
                room: c.room,
                total_lessons: c.total_lessons,
                effective_total_lessons: effectiveTotalLessons,
                teacher: c.teachers,
                centre: c.centres,
                student_count: c.class_students?.length || 0,
                completed_lessons: completedLessons
              }
            })
          )
          setClasses(classesWithProgress)
        }

        // If admin, fetch teachers, centres, and students for the add form
        if (profile.has_admin_access || profile.is_super_admin) {
          const { data: teachersData } = await supabase
            .from('teachers')
            .select('*')
            .eq('organisation_id', profile.organisation_id)

          if (teachersData) setTeachers(teachersData)

          const { data: centresData } = await supabase
            .from('centres')
            .select('id, name')
            .eq('organisation_id', profile.organisation_id)

          if (centresData) setCentres(centresData)

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
  }, [classView])

  useEffect(() => {
    if (!userProfile) return

    const isAdminUser = userProfile.has_admin_access || userProfile.is_super_admin
    const isTeacherUser = userProfile.teacher_id !== null

    if (isAdminUser && !isTeacherUser) {
      setClassView('admin')
    } else if (isTeacherUser && !isAdminUser) {
      setClassView('teacher')
    }
  }, [userProfile])

  const handleTeacherChange = (teacherId: string) => {
    setClassForm({ ...classForm, teacher_id: teacherId, subject: '' })

    const selectedTeacher = teachers.find(t => t.id === teacherId)
    if (selectedTeacher) {
      supabase
        .from('teachers')
        .select('subjects')
        .eq('id', teacherId)
        .single()
        .then(({ data }) => {
          if (data && data.subjects && Array.isArray(data.subjects)) {
            setAvailableSubjects(data.subjects)
          } else {
            setAvailableSubjects([])
          }
        })
    } else {
      setAvailableSubjects([])
    }
  }

  const handleAddClass = async () => {
    if (!classForm.name || !classForm.subject || !classForm.teacher_id || !classForm.centre_id ||
        !classForm.day_of_week || !classForm.start_time || !classForm.end_time || !organisationId) {
      alert('Please fill in all required fields')
      return
    }

    if (!classForm.start_date) {
      alert('Please select a start date for the first lesson')
      return
    }

    if (selectedStudents.length === 0) {
      alert('Please add at least one student')
      return
    }

    const cleanedCoTeacherAssignments = coTeacherAssignments
      .map((assignment) => ({ date: assignment.date.trim(), teacher_id: assignment.teacher_id }))
      .filter((assignment) => assignment.date && assignment.teacher_id)

    setSavingClass(true)
    try {
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

      // Generate lesson schedule
      if (newClass && classForm.total_lessons && classForm.start_date) {
        const totalLessons = parseInt(classForm.total_lessons)
        const startDate = new Date(classForm.start_date)
        const lessonRecords: LessonRecord[] = []
        const coTeacherByDate = new Map(
          cleanedCoTeacherAssignments.map((assignment) => [assignment.date, assignment.teacher_id])
        )
        
        for (let i = 0; i < totalLessons; i++) {
          const lessonDate = new Date(startDate)
          lessonDate.setDate(startDate.getDate() + (i * 7))
          const formattedDate = lessonDate.toISOString().split('T')[0]      

          lessonRecords.push({
            class_id: newClass.id,
            lesson_number: i + 1,
            scheduled_date: formattedDate,
            status: 'scheduled',
            notes: null,
            co_teacher_id: coTeacherByDate.get(formattedDate) || null
          })
        }

        const { error: lessonsError } = await supabase
          .from('lesson_statuses')
          .insert(lessonRecords)

        if (lessonsError) {
          console.error('Error creating lesson schedule:', lessonsError)
          alert(`Class created but failed to generate lesson schedule: ${lessonsError.message}`)
        }

        const unmatchedCoTeacherDates = cleanedCoTeacherAssignments.filter(
          (assignment) => !lessonRecords.some((lesson) => lesson.scheduled_date === assignment.date)
        )

        if (unmatchedCoTeacherDates.length > 0) {
          alert('Some co-teacher dates did not match scheduled lessons and were skipped.')
        }
      }

      // Assign students to the class
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
        start_date: '',
      })
      setSelectedStudents([])
      setCoTeacherAssignments([{ date: '', teacher_id: '' }])
    } catch (error: any) {
      console.error('Error adding class:', error)
      alert(error.message || 'Failed to add class')
    } finally {
      setSavingClass(false)
    }
  }

  const isTeacher = userProfile?.teacher_id !== null
  const isAdminView = Boolean(isAdmin && (!isTeacher || classView === 'admin'))
  const isTeacherView = Boolean(isTeacher && (!isAdmin || classView === 'teacher'))

  const sortClasses = (a: Class, b: Class) =>
    a.subject.localeCompare(b.subject) || a.name.localeCompare(b.name)

  // Group classes by subject (like iOS app)
  const classesBySubject = classes.reduce((acc, cls) => {
    const subject = cls.subject.toUpperCase()
    if (!acc[subject]) acc[subject] = []
    acc[subject].push(cls)
    return acc
  }, {} as Record<string, Class[]>)

  const classesByTeacher = classes.reduce((acc, cls) => {
    const teacherLabel = getTeacherLabel(cls.teacher)
    if (!acc[teacherLabel]) acc[teacherLabel] = []
    acc[teacherLabel].push(cls)
    return acc
  }, {} as Record<string, Class[]>)

  const subjectEntries = Object.entries(classesBySubject)
  const teacherEntries = Object.entries(classesByTeacher).sort(([a], [b]) => a.localeCompare(b))

  subjectEntries.forEach(([, subjectClasses]) => subjectClasses.sort(sortClasses))
  teacherEntries.forEach(([, teacherClasses]) => teacherClasses.sort(sortClasses))

  useEffect(() => {
    if (!isAdminView) return
    setCollapsedTeachers((prev) => {
      let changed = false
      const next = { ...prev }
      teacherEntries.forEach(([teacherLabel]) => {
        if (next[teacherLabel] === undefined) {
          next[teacherLabel] = true
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [isAdminView, teacherEntries])
  const toggleTeacherGroup = (teacherLabel: string) => {
    setCollapsedTeachers((prev) => ({
      ...prev,
      [teacherLabel]: !prev[teacherLabel]
    }))
  }

  if (loading) {
    return <div className="text-center py-12">Loading classes...</div>
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Header */}
      <div className="mb-6">
        <p className="text-sm text-gray-600">{classes.length} Active Classes</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-4xl font-bold text-gray-900">Classes</h1>
            {isAdminView && (
              <span className="text-sm text-gray-600">(Admin View - All Teachers)</span>
            )}
            {isTeacherView && (
              <span className="text-sm text-gray-600">(Teacher View - My Classes)</span>
            )}
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowAddClass(true)}
              className="flex items-center justify-center w-12 h-12 bg-brand-secondary text-white rounded-full hover:bg-blue-600 transition-colors shadow-lg"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
        </div>
        {isAdmin && isTeacher && (
          <div className="mt-3 flex items-center gap-3">
            <span className="text-sm text-gray-600">View:</span>
            <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setClassView('admin')}
                aria-pressed={isAdminView}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  isAdminView
                    ? 'bg-brand-primary text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => setClassView('teacher')}
                aria-pressed={isTeacherView}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  isTeacherView
                    ? 'bg-brand-primary text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Teacher
              </button>
            </div>
          </div>
        )}
      </div>

      {classes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500">No classes found.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {(isAdminView ? teacherEntries : subjectEntries).map(([groupLabel, groupClasses]) => (
            <div key={groupLabel}>
              {isAdminView ? (
                <button
                  type="button"
                  onClick={() => toggleTeacherGroup(groupLabel)}
                  aria-expanded={!collapsedTeachers[groupLabel]}
                  className="flex items-center gap-2 text-base font-bold text-gray-900 mb-3 px-1"
                >
                  <svg
                    className={`w-4 h-4 text-gray-500 transition-transform ${
                      collapsedTeachers[groupLabel] ? '-rotate-90' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span>{groupLabel}</span>
                </button>
              ) : (
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3 px-1">
                  {groupLabel}
                </h3>
              )}
              {!isAdminView || !collapsedTeachers[groupLabel] ? (
                <div className="space-y-3">
                  {groupClasses.map((cls) => {
                    const progress = cls.effective_total_lessons
                      ? (cls.completed_lessons / cls.effective_total_lessons) * 100
                      : 0
                    const locationLabel =
                      [cls.room, cls.centre?.name].filter(Boolean).join(' • ') || 'No location'
                      
                return (
                      <Link
                        key={cls.id}
                        href={`/dashboard/classes/${cls.id}`}
                        className="block"
                      >
                        <div className="bg-white rounded-xl p-5 border border-gray-200 hover:border-brand-primary hover:shadow-md transition-all">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{cls.subject}</p>
                              <h4 className="text-lg font-semibold text-gray-900">
                                {daysOfWeekShort[cls.day_of_week]}, {cls.start_time} - {cls.end_time}
                              </h4>
                            </div>
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>

                          <div className="flex items-center gap-3 text-sm text-gray-600 mb-3">
                            <div className="flex items-center gap-1.5">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span>{cls.name}</span>
                            </div>
                          </div>

                          {!isAdminView && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A9 9 0 1119 9a4 4 0 00-7.293 7.293M15 21H9a4 4 0 010-8h6a4 4 0 010 8z" />
                              </svg>
                              <span>{getTeacherLabel(cls.teacher)}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>{locationLabel}</span>
                          </div>

                          {/* Lesson Progress */}
                          {cls.effective_total_lessons > 0 && (
                            <div className="mb-4">
                              <div className="flex items-center justify-between text-sm mb-1.5">
                                <span className="text-gray-600">Lesson Progress</span>
                                <span className="font-medium text-brand-secondary">
                                  {cls.completed_lessons}/{cls.effective_total_lessons}
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-brand-secondary h-2 rounded-full transition-all"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Student Count */}
                          <div className="flex items-center gap-2 text-sm bg-gray-100 rounded-lg px-3 py-2 w-fit">
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            <span className="font-medium text-gray-700">
                              {cls.student_count} enrolled
                            </span>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* Add Class Modal - keeping existing modal code */}
      {showAddClass && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add New Class</h3>
              <button
                onClick={() => {
                  setShowAddClass(false)
                  setAvailableSubjects([])
                  setSelectedStudents([])
                  setCoTeacherAssignments([{ date: '', teacher_id: '' }])
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              {/* Teacher Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teacher *</label>
                <select
                  value={classForm.teacher_id}
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

              {/* Subject Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
                <select
                  value={classForm.subject}
                  onChange={(e) => setClassForm({ ...classForm, subject: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary disabled:bg-gray-100 disabled:cursor-not-allowed"
                  disabled={!classForm.teacher_id || availableSubjects.length === 0}
                >
                  <option value="">
                    {!classForm.teacher_id
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

              {/* Centre Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Centre *</label>
                <select
                  value={classForm.centre_id}
                  onChange={(e) => setClassForm({ ...classForm, centre_id: e.target.value })}
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

              {/* Day and Time */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Day *</label>
                  <select
                    value={classForm.day_of_week}
                    onChange={(e) => setClassForm({ ...classForm, day_of_week: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                  >
                    <option value="">Select day</option>
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

              {/* Class Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class Name *</label>
                <input
                  type="text"
                  value={classForm.name}
                  onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                  placeholder="e.g., K1"
                />
              </div>

              {/* Number of Lessons, Start Date, and Room */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Number of Lessons *</label>
                  <input
                    type="number"
                    value={classForm.total_lessons}
                    onChange={(e) => setClassForm({ ...classForm, total_lessons: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                    placeholder="e.g., 8"
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Lesson Date *</label>
                  <input
                    type="date"
                    value={classForm.start_date}
                    onChange={(e) => setClassForm({ ...classForm, start_date: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Room (Optional)</label>
                  <input
                    type="text"
                    value={classForm.room}
                    onChange={(e) => setClassForm({ ...classForm, room: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                    placeholder="e.g., Room 101"
                  />
                </div>
              </div>

              {/* Co-teacher Assignments */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-700">Co-teacher Assignments (Optional)</h4>
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
                          .filter((teacher) => teacher.id !== classForm.teacher_id)
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
                  Assign a co-teacher to specific lesson dates. Only dates that match scheduled lessons will be applied.
                </p>
              </div>

              {/* Assign Students */}
              <div className="pt-2 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assign Students * ({selectedStudents.length} assigned)
                </label>

                <div className="mb-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={studentSearchQuery}
                      onChange={(e) => {
                        setStudentSearchQuery(e.target.value)
                        if (e.target.value) {
                          const filtered = students.filter(s =>
                            s.name.toLowerCase().includes(e.target.value.toLowerCase()) &&
                            !selectedStudents.includes(s.id)
                          )
                          setFilteredStudents(filtered)
                        } else {
                          setFilteredStudents([])
                        }
                      }}
                      onKeyPress={async (e) => {
                        if (e.key === 'Enter' && studentSearchQuery.trim()) {
                          e.preventDefault()
                          const existingStudent = students.find(
                            s => s.name.toLowerCase() === studentSearchQuery.trim().toLowerCase()
                          )

                          if (existingStudent && !selectedStudents.includes(existingStudent.id)) {
                            setSelectedStudents([...selectedStudents, existingStudent.id])
                            setStudentSearchQuery('')
                            setFilteredStudents([])
                          } else if (!existingStudent) {
                            const { data: newStudent, error } = await supabase
                              .from('students')
                              .insert({
                                name: studentSearchQuery.trim(),
                                organisation_id: organisationId
                              })
                              .select()
                              .single()

                            if (error) {
                              alert('Failed to create student')
                              return
                            }

                            if (newStudent) {
                              setStudents([...students, newStudent])
                              setSelectedStudents([...selectedStudents, newStudent.id])
                              setStudentSearchQuery('')
                              setFilteredStudents([])
                            }
                          }
                        }
                      }}
                      placeholder="Type student name and press Enter..."
                      className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                    />
                  </div>

                  {filteredStudents.length > 0 && (
                    <div className="mt-1 border border-gray-200 rounded-lg bg-white shadow-lg max-h-48 overflow-y-auto">
                      {filteredStudents.map((student) => (
                        <button
                          key={student.id}
                          onClick={() => {
                            setSelectedStudents([...selectedStudents, student.id])
                            setStudentSearchQuery('')
                            setFilteredStudents([])
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm"
                        >
                          {student.name}
                        </button>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-gray-500 mt-1">
                    Type a name and press Enter. If the student doesn't exist, a new one will be created.
                  </p>
                </div>

                {selectedStudents.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedStudents.map((studentId) => {
                      const student = students.find(s => s.id === studentId)
                      return (
                        <div
                          key={studentId}
                          className="flex items-center gap-1 bg-brand-secondary bg-opacity-10 text-brand-secondary px-3 py-1 rounded-full text-sm"
                        >
                          <span>{student?.name}</span>
                          <button
                            onClick={() => setSelectedStudents(selectedStudents.filter(id => id !== studentId))}
                            className="hover:text-red-600"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button
                  onClick={() => {
                    setShowAddClass(false)
                    setClassForm({
                      teacher_id: '',
                      subject: '',
                      centre_id: '',
                      day_of_week: '',
                      start_time: '',
                      end_time: '',
                      name: '',
                      room: '',
                      total_lessons: '',
                      start_date: '',
                    })
                    setSelectedStudents([])
                    setAvailableSubjects([])
                    setStudentSearchQuery('')
                    setFilteredStudents([])
                    setCoTeacherAssignments([{ date: '', teacher_id: '' }])
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddClass}
                  disabled={savingClass || !classForm.name || selectedStudents.length === 0}
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
