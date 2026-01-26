'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface CentreClass {
  id: string
  name: string
  centre_id: string
  centres:
    | {
        id: string
        name: string
      }
    | {
        id: string
        name: string
      }[]
    | null
}

interface CentreGroup {
  id: string
  name: string
  classes: { id: string; name: string }[]
}

interface Student {
  id: string
  name: string
}

const getTodayDateString = () => new Date().toISOString().split('T')[0]

export default function StudentNamelistPage() {
  const [centres, setCentres] = useState<CentreGroup[]>([])
  const [expandedCentreId, setExpandedCentreId] = useState<string | null>(null)
  const [selectedClass, setSelectedClass] = useState<{ id: string; name: string } | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [studentLoading, setStudentLoading] = useState(false)
  const [newStudentName, setNewStudentName] = useState('')
  const [newStudentStartDate, setNewStudentStartDate] = useState(getTodayDateString())
  const [addingStudent, setAddingStudent] = useState(false)
  const [organisationId, setOrganisationId] = useState<string | null>(null)

  useEffect(() => {
    const fetchCentresWithClasses = async () => {
      try {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: profile } = await supabase
          .from('users')
          .select('organisation_id, has_admin_access, is_super_admin')
          .eq('auth_id', user.id)
          .single()

        if (!profile?.organisation_id) return

        setOrganisationId(profile.organisation_id)

        if (!profile.has_admin_access && !profile.is_super_admin) return

        const { data: classData } = await supabase
          .from('classes')
          .select('id, name, centre_id, centres:centre_id (id, name)')
          .eq('organisation_id', profile.organisation_id)
          .order('name')

        if (!classData) {
          setCentres([])
          return
        }

        const centreMap = new Map<string, CentreGroup>()
        classData.forEach((cls: CentreClass) => {
          const centre = Array.isArray(cls.centres) ? cls.centres[0] : cls.centres
          if (!centre) return
          const centreId = centre.id
          if (!centreMap.has(centreId)) {
            centreMap.set(centreId, {
              id: centreId,
              name: centre.name,
              classes: []
            })
          }
          centreMap.get(centreId)?.classes.push({ id: cls.id, name: cls.name })
        })

        const grouped = Array.from(centreMap.values()).sort((a, b) => a.name.localeCompare(b.name))
        grouped.forEach((group) => {
          group.classes.sort((a, b) => a.name.localeCompare(b.name))
        })

        setCentres(grouped)
      } catch (error) {
        console.error('Error fetching centres and classes:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCentresWithClasses()
  }, [])

  const handleToggleCentre = (centreId: string) => {
    setExpandedCentreId((prev) => (prev === centreId ? null : centreId))
  }

  const handleOpenClass = async (cls: { id: string; name: string }) => {
    setSelectedClass(cls)
    setNewStudentName('')
    setNewStudentStartDate(getTodayDateString())
    setStudents([])
    setStudentLoading(true)
    try {
      const { data } = await supabase
        .from('class_students')
        .select('students:student_id (id, name)')
        .eq('class_id', cls.id)

      const fetchedStudents =
        data?.map((row: any) => ({
          id: row.students?.id,
          name: row.students?.name
        }))
        .filter((student: Student) => student.id && student.name) || []

      setStudents(fetchedStudents.sort((a, b) => a.name.localeCompare(b.name)))
    } catch (error) {
      console.error('Error fetching class students:', error)
    } finally {
      setStudentLoading(false)
    }
  }

  const handleAddStudent = async () => {
    if (!selectedClass || !organisationId || !newStudentName.trim() || !newStudentStartDate) return

    const cleanedName = newStudentName.trim()
    setAddingStudent(true)
    try {
      const { data: existingStudent } = await supabase
        .from('students')
        .select('id, name')
        .eq('organisation_id', organisationId)
        .ilike('name', cleanedName)
        .limit(1)
        .maybeSingle()

      let studentId = existingStudent?.id

      if (!studentId) {
        const { data: newStudent, error: createError } = await supabase
          .from('students')
          .insert({
            name: cleanedName,
            organisation_id: organisationId
          })
          .select('id, name')
          .single()

        if (createError) throw createError
        studentId = newStudent?.id
      }

      if (!studentId) return

      const { data: existingAssignment } = await supabase
        .from('class_students')
        .select('id')
        .eq('class_id', selectedClass.id)
        .eq('student_id', studentId)
        .maybeSingle()

      if (!existingAssignment) {
        const { error: assignmentError } = await supabase
          .from('class_students')
          .insert({
            class_id: selectedClass.id,
            student_id: studentId,
            enrolled_at: newStudentStartDate
          })

        if (assignmentError) throw assignmentError
      }

      await handleOpenClass(selectedClass)
      setNewStudentName('')
    } catch (error) {
      console.error('Error adding student:', error)
      alert('Failed to add student to class')
    } finally {
      setAddingStudent(false)
    }
  }

  const totalClasses = useMemo(() => centres.reduce((sum, centre) => sum + centre.classes.length, 0), [centres])

  if (loading) {
    return <div className="text-center py-12">Loading student namelist...</div>
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <p className="text-sm text-gray-600">{totalClasses} Active Classes</p>
        <h1 className="text-3xl font-bold text-gray-900">Student Namelist</h1>
        <p className="text-sm text-gray-500 mt-1">
          Browse centres with active classes, then view and update each class roster.
        </p>
      </div>

      {centres.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500">No active classes found for your centres.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {centres.map((centre) => {
            const isExpanded = expandedCentreId === centre.id
            return (
              <div key={centre.id} className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <button
                  type="button"
                  onClick={() => handleToggleCentre(centre.id)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left"
                  aria-expanded={isExpanded}
                >
                  <div>
                    <p className="text-lg font-semibold text-gray-900">{centre.name}</p>
                    <p className="text-xs text-gray-500">{centre.classes.length} active class(es)</p>
                  </div>
                  <svg
                    className={`h-5 w-5 text-gray-400 transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-4">
                    <div className="space-y-2">
                      {centre.classes.map((cls) => (
                        <button
                          key={cls.id}
                          type="button"
                          onClick={() => handleOpenClass(cls)}
                          className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-left text-sm font-medium text-gray-700 hover:border-brand-primary hover:bg-white"
                        >
                          <span>{cls.name}</span>
                          <span className="text-xs text-gray-500">View students</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {selectedClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{selectedClass.name}</h2>
                <p className="text-xs text-gray-500">Student Namelist</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClass(null)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close student namelist"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Add new student to this class
              </label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <input
                  type="text"
                  value={newStudentName}
                  onChange={(event) => setNewStudentName(event.target.value)}
                  placeholder="Student full name"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                />
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-gray-500 mb-1">Start date</label>
                  <input
                    type="date"
                    value={newStudentStartDate}
                    onChange={(event) => setNewStudentStartDate(event.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddStudent}
                  disabled={addingStudent || !newStudentName.trim()}
                  className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary-dark disabled:opacity-50"
                >
                  {addingStudent ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Lessons before the start date will default to prorated attendance.
            </p>
            
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Enrolled Students</h3>
              {studentLoading ? (
                <p className="text-sm text-gray-500">Loading students...</p>
              ) : students.length === 0 ? (
                <p className="text-sm text-gray-500">No students enrolled yet.</p>
              ) : (
                <ul className="max-h-64 space-y-2 overflow-y-auto">
                  {students.map((student) => (
                    <li
                      key={student.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
                    >
                      <span>{student.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
