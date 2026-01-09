'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface UserProfile {
  id: string
  username: string | null
  email: string
  organisation_id: string | null
  full_name: string | null
  teacher_id: string | null
  has_admin_access: boolean
  is_super_admin: boolean
}

interface Teacher {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  organisation_id: string | null
}

interface Centre {
  id: string
  name: string
  address: string | null
  phone: string | null
  email: string | null
  organisation_id: string | null
}

interface TeacherCentre {
  teacher_id: string
  centre_id: string
  centres: Centre
}

interface CentreNote {
  id: string
  centre_id: string
  note: string
  created_at: string
}

interface TeacherNote {
  id: string
  teacher_id: string
  title: string
  note: string
  created_at: string
}

interface TeacherNotification {
  id: string
  teacher_id: string
  message: string
  is_read: boolean
  created_at: string
}

interface Organisation {
  id: string
  name: string
}

export default function ProfilePage() {
  const defaultTeacherPassword = 'password123'
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [organisation, setOrganisation] = useState<Organisation | null>(null)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [centres, setCentres] = useState<Centre[]>([])
  const [myNotes, setMyNotes] = useState<TeacherNote[]>([])
  const [notifications, setNotifications] = useState<TeacherNotification[]>([])
  const [loading, setLoading] = useState(true)

  // Teacher management states
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null)
  const [showAddTeacher, setShowAddTeacher] = useState(false)
  const [showEditTeacher, setShowEditTeacher] = useState(false)
  const [teacherForm, setTeacherForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    subjects: '',
    password: '',
    has_admin_access: false
  })
  const [teacherCentres, setTeacherCentres] = useState<string[]>([])
  const [savingTeacher, setSavingTeacher] = useState(false)
  const [resettingPassword, setResettingPassword] = useState(false)
  const [selectedTeacherNotes, setSelectedTeacherNotes] = useState<TeacherNote[]>([])
  const [adminNoteForm, setAdminNoteForm] = useState({
    title: '',
    note: ''
  })
  const [savingAdminNote, setSavingAdminNote] = useState(false)
  
  // Centre management states
  const [selectedCentre, setSelectedCentre] = useState<Centre | null>(null)
  const [showAddCentre, setShowAddCentre] = useState(false)
  const [showEditCentre, setShowEditCentre] = useState(false)
  const [centreForm, setCentreForm] = useState({
    name: '',
    address: '',
    phone: '',
    email: ''
  })
  const [centreNotes, setCentreNotes] = useState<CentreNote[]>([])
  const [newCentreNote, setNewCentreNote] = useState('')
  const [savingCentre, setSavingCentre] = useState(false)

  // Notes management states
  const [showAddNote, setShowAddNote] = useState(false)
  const [noteForm, setNoteForm] = useState({
    title: '',
    note: ''
  })
  const [savingNote, setSavingNote] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [changingPassword, setChangingPassword] = useState(false)

  const isMissingColumnError = (error: any, column: string) => {
    if (!error) return false
    if (error.code === '42703') return true
    if (typeof error.message === 'string' && error.message.includes(`column "${column}"`)) return true
    if (typeof error.details === 'string' && error.details.includes(`column "${column}"`)) return true
    return false
  }
  
  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        console.log('Auth user:', user)
        if (!user) return

        // Fetch user profile
        let { data: profileData, error: profileError } = await supabase
          .from('users')
          .select('id, username, organisation_id, full_name, teacher_id, has_admin_access, is_super_admin')
          .eq('auth_id', user.id)
          .single()

        // If no profile exists, create one
        if (profileError && profileError.code === 'PGRST116') {
          const { data: newProfile, error: insertError } = await supabase
            .from('users')
            .insert({
              auth_id: user.id,
              email: user.email,
              username: user.email?.split('@')[0] || null,
              full_name: user.user_metadata?.full_name || null
            })
            .select('id, username, organisation_id, full_name, teacher_id, has_admin_access, is_super_admin')
            .single()

          if (insertError) {
            console.error('Error creating profile:', insertError)
            return
          }

          profileData = newProfile
        } else if (profileError) {
          console.error('Profile error:', profileError)
          return
        }

        if (profileData) {
          setProfile({
            ...profileData,
            email: user.email || ''
          })

          // Fetch organisation if user has one
          if (profileData.organisation_id) {
            const { data: orgData } = await supabase
              .from('organisations')
              .select('id, name')
              .eq('id', profileData.organisation_id)
              .single()

            if (orgData) {
              setOrganisation(orgData)
            }
          }

          // If admin, fetch teachers and centres
          if (profileData.has_admin_access || profileData.is_super_admin) {
            if (profileData.organisation_id) {
              // Fetch teachers
              const { data: teachersData } = await supabase
                .from('teachers')
                .select('id, full_name, email, phone, organisation_id')
                .eq('organisation_id', profileData.organisation_id)

              if (teachersData) {
                setTeachers(teachersData)
              }

              // Fetch centres
              const { data: centresData } = await supabase
                .from('centres')
                .select('id, name, address, phone, email, organisation_id')
                .eq('organisation_id', profileData.organisation_id)

              if (centresData) {
                setCentres(centresData)
              }
            }
          }

          // If teacher, fetch notes and notifications
          if (profileData.teacher_id) {
            await loadMyNotes(profileData.teacher_id)

            // Fetch teacher notifications
            const { data: notificationsData } = await supabase
              .from('teacher_notifications')
              .select('id, teacher_id, message, is_read, created_at')
              .eq('teacher_id', profileData.teacher_id)
              .order('created_at', { ascending: false })

            if (notificationsData) {
              setNotifications(notificationsData)
            }
          }
        }
      } catch (error) {
        console.error('Error fetching profile:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProfileData()
  }, [])

  const handleAddTeacher = async () => {
    if (!teacherForm.full_name || !teacherForm.email || !teacherForm.password || !profile?.organisation_id) {
      alert('Please fill in all required fields (name, email, and password)')
      return
    }

    if (teacherForm.password.length < 8) {
      alert('Password must be at least 8 characters long')
      return
    }

    setSavingTeacher(true)
    try {
      // Call edge function to create teacher with auth account
      const response = await supabase.functions.invoke('create-teacher', {
        body: {
          full_name: teacherForm.full_name,
          email: teacherForm.email,
          phone: teacherForm.phone || null,
          subjects: teacherForm.subjects || null,
          password: teacherForm.password,
          has_admin_access: teacherForm.has_admin_access,
          organisation_id: profile.organisation_id,
          centre_ids: teacherCentres
        }
      })

      console.log('Full function response:', response)
      console.log('Response data:', response.data)
      console.log('Response error:', response.error)

      // Try to get more error details
      if (response.error) {
        console.error('Function invocation error:', response.error)
        console.error('Error context:', (response.error as any).context)
        console.error('Error details:', JSON.stringify(response.error, null, 2))
      }

      // Check for function invocation error
      if (response.error) {
        // Try to extract the actual error message from the response data
        const errorMsg = response.data?.error || response.error.message || 'Unknown error'
        console.error('Extracted error message:', errorMsg)
        alert(`Failed to create teacher: ${errorMsg}`)
        return
      }

      // Check if the response contains an error field (returned from edge function)
      if (response.data?.error) {
        console.error('Edge function returned error:', response.data.error)
        alert(`Failed to create teacher: ${response.data.error}`)
        return
      }

      // Check for success
      if (response.data?.teacher) {
        setTeachers([...teachers, response.data.teacher])
        setTeacherForm({ full_name: '', email: '', phone: '', address: '', subjects: '', password: '', has_admin_access: false })
        setTeacherCentres([])
        setShowAddTeacher(false)
        alert('Teacher created successfully!')
      } else {
        console.error('Unexpected response structure:', response.data)
        alert('Unexpected response from server. Check console for details.')
      }
    } catch (error: any) {
      console.error('Exception while adding teacher:', error)
      alert(error.message || 'Failed to add teacher')
    } finally {
      setSavingTeacher(false)
    }
  }

  const handleEditTeacher = async () => {
    if (!selectedTeacher || !teacherForm.full_name) return

    setSavingTeacher(true)
    try {
      const { error } = await supabase
        .from('teachers')
        .update({
          full_name: teacherForm.full_name,
          email: teacherForm.email || null,
          phone: teacherForm.phone || null
        })
        .eq('id', selectedTeacher.id)

      if (error) throw error

      setTeachers(teachers.map(t =>
        t.id === selectedTeacher.id
          ? { ...t, ...teacherForm }
          : t
      ))
      setShowEditTeacher(false)
      setSelectedTeacher(null)
    } catch (error) {
      console.error('Error updating teacher:', error)
      alert('Failed to update teacher')
    } finally {
      setSavingTeacher(false)
    }
  }

  const handleResetTeacherPassword = async () => {
    if (!selectedTeacher) return

    const confirmed = window.confirm(
      `Reset password for ${selectedTeacher.full_name || selectedTeacher.email || 'this teacher'}? ` +
      `The new default password will be "${defaultTeacherPassword}".`
    )

    if (!confirmed) return

    setResettingPassword(true)
    try {
      const response = await supabase.functions.invoke('reset-teacher-password', {
        body: {
          teacher_id: selectedTeacher.id,
          password: defaultTeacherPassword
        }
      })

      if (response.error) {
        throw response.error
      }

      if (response.data?.error) {
        throw new Error(response.data.error)
      }

      alert('Teacher password reset to the default password.')
    } catch (error: any) {
      console.error('Error resetting teacher password:', error)
      alert(error.message || 'Failed to reset teacher password')
    } finally {
      setResettingPassword(false)
    }
  }

  const loadTeacherCentres = async (teacherId: string) => {
    const { data } = await supabase
      .from('teacher_centres')
      .select('centre_id')
      .eq('teacher_id', teacherId)

    if (data) {
      setTeacherCentres(data.map(tc => tc.centre_id))
    }
  }

  const loadTeacherNotes = async (teacherId: string) => {
    const { data, error } = await supabase
      .from('teacher_notes')
      .select('id, teacher_id, title, note, created_at')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false })

    if (data) {
      setSelectedTeacherNotes(data)
      return
    }

    if (error && isMissingColumnError(error, 'title')) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('teacher_notes')
        .select('id, teacher_id, note, created_at')
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false })

      if (fallbackError) {
        console.error('Error loading teacher notes (fallback):', fallbackError)
        return
      }

      if (fallbackData) {
        setSelectedTeacherNotes(
          fallbackData.map(note => ({
            ...note,
            title: 'Note'
          }))
        )
      }
      return
    }

    if (error) {
      console.error('Error loading teacher notes:', error)
    }
  }

  const loadMyNotes = async (teacherId: string) => {
    const { data, error } = await supabase
      .from('teacher_notes')
      .select('id, teacher_id, title, note, created_at')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false })

    if (data) {
      setMyNotes(data)
      return
    }

    if (error && isMissingColumnError(error, 'title')) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('teacher_notes')
        .select('id, teacher_id, note, created_at')
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false })

      if (fallbackError) {
        console.error('Error loading my notes (fallback):', fallbackError)
        return
      }

      if (fallbackData) {
        setMyNotes(
          fallbackData.map(note => ({
            ...note,
            title: 'Note'
          }))
        )
      }
      return
    }

    if (error) {
      console.error('Error loading my notes:', error)
    }
  }

  const handleAssignCentre = async (teacherId: string, centreId: string, isAssigned: boolean) => {
    try {
      if (isAssigned) {
        // Remove assignment
        const { error } = await supabase
          .from('teacher_centres')
          .delete()
          .eq('teacher_id', teacherId)
          .eq('centre_id', centreId)

        if (error) throw error
        setTeacherCentres(teacherCentres.filter(id => id !== centreId))
      } else {
        // Add assignment
        const { error } = await supabase
          .from('teacher_centres')
          .insert({ teacher_id: teacherId, centre_id: centreId })

        if (error) throw error
        setTeacherCentres([...teacherCentres, centreId])
      }
    } catch (error) {
      console.error('Error assigning centre:', error)
      alert('Failed to assign centre')
    }
  }

  const handleAddCentre = async () => {
    if (!centreForm.name || !profile?.organisation_id) return

    setSavingCentre(true)
    try {
      const { data, error } = await supabase
        .from('centres')
        .insert({
          name: centreForm.name,
          address: centreForm.address || null,
          phone: null,
          email: null,
          organisation_id: profile.organisation_id
        })
        .select()
        .single()

      if (error) throw error

      if (data) {
        setCentres([...centres, data])
        setCentreForm({ name: '', address: '', phone: '', email: '' })
        setShowAddCentre(false)
      }
    } catch (error) {
      console.error('Error adding centre:', error)
      alert('Failed to add centre')
    } finally {
      setSavingCentre(false)
    }
  }

  const handleEditCentre = async () => {
    if (!selectedCentre || !centreForm.name) return

    setSavingCentre(true)
    try {
      const { error } = await supabase
        .from('centres')
        .update({
          name: centreForm.name,
          address: centreForm.address || null
        })
        .eq('id', selectedCentre.id)

      if (error) throw error

      setCentres(centres.map(c =>
        c.id === selectedCentre.id
          ? { ...c, name: centreForm.name, address: centreForm.address }
          : c
      ))
      setShowEditCentre(false)
      setSelectedCentre(null)
    } catch (error) {
      console.error('Error updating centre:', error)
      alert('Failed to update centre')
    } finally {
      setSavingCentre(false)
    }
  }

  const loadCentreNotes = async (centreId: string) => {
    const { data } = await supabase
      .from('centre_notes')
      .select('id, centre_id, note, created_at')
      .eq('centre_id', centreId)
      .order('created_at', { ascending: false })

    if (data) {
      setCentreNotes(data)
    }
  }

  const handleAddCentreNote = async (centreId: string) => {
    if (!newCentreNote.trim()) return

    try {
      const { data, error } = await supabase
        .from('centre_notes')
        .insert({
          centre_id: centreId,
          note: newCentreNote
        })
        .select()
        .single()

      if (error) throw error

      if (data) {
        setCentreNotes([data, ...centreNotes])
        setNewCentreNote('')
      }
    } catch (error) {
      console.error('Error adding centre note:', error)
      alert('Failed to add note')
    }
  }

  const handleAddNote = async () => {
    const title = noteForm.title.trim()
    const note = noteForm.note.trim()

    if (!title || !note) {
      alert('Please fill in both the title and note fields')
      return
    }

    if (!profile?.teacher_id) {
      alert('Unable to add note: teacher profile is missing')
      return
    }

    setSavingNote(true)
    try {
      let { data, error } = await supabase
        .from('teacher_notes')
        .insert({
          teacher_id: profile.teacher_id,
          title,
          note
        })
        .select('id, teacher_id, title, note, created_at')

      if (error && isMissingColumnError(error, 'title')) {
        const fallbackResponse = await supabase
          .from('teacher_notes')
          .insert({
            teacher_id: profile.teacher_id,
            note
          })
          .select('id, teacher_id, note, created_at')

        data = fallbackResponse.data?.map(fallbackNote => ({
          ...fallbackNote,
          title
        }))
        error = fallbackResponse.error
      }
      
      if (error) {
        throw error
      }

      const insertedNote = data?.[0]

      if (insertedNote) {
        setMyNotes([insertedNote, ...myNotes])
      } else {
        await loadMyNotes(profile.teacher_id)
      }

      setNoteForm({ title: '', note: '' })
      setShowAddNote(false)
    } catch (error) {
      console.error('Error adding note:', error)
      alert('Failed to add note')
    } finally {
      setSavingNote(false)
    }
  }

  const handleAddTeacherNote = async (teacherId: string) => {
    const title = adminNoteForm.title.trim()
    const note = adminNoteForm.note.trim()

    if (!title || !note) {
      alert('Please fill in both the title and note fields')
      return
    }

    setSavingAdminNote(true)
    try {
      let { data, error } = await supabase
        .from('teacher_notes')
        .insert({
          teacher_id: teacherId,
          title,
          note
        })
        .select('id, teacher_id, title, note, created_at')

      if (error && isMissingColumnError(error, 'title')) {
        const fallbackResponse = await supabase
          .from('teacher_notes')
          .insert({
            teacher_id: teacherId,
            note
          })
          .select('id, teacher_id, note, created_at')

        data = fallbackResponse.data?.map(fallbackNote => ({
          ...fallbackNote,
          title
        }))
        error = fallbackResponse.error
      }
      
      if (error) {
        throw error
      }

      const insertedNote = data?.[0]

      if (insertedNote) {
        setSelectedTeacherNotes([insertedNote, ...selectedTeacherNotes])
      } else {
        await loadTeacherNotes(teacherId)
      }

      setAdminNoteForm({ title: '', note: '' })

      const { error: notificationError } = await supabase
        .from('teacher_notifications')
        .insert({
          teacher_id: teacherId,
          message: `New note from admin: ${title}`,
          is_read: false
        })

      if (notificationError) {
        console.error('Error creating notification:', notificationError)
      }
    } catch (error) {
      console.error('Error adding teacher note:', error)
      alert('Failed to add note')
    } finally {
      setSavingAdminNote(false)
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('teacher_notes')
        .delete()
        .eq('id', noteId)

      if (error) throw error

      setMyNotes(myNotes.filter(n => n.id !== noteId))
    } catch (error) {
      console.error('Error deleting note:', error)
      alert('Failed to delete note')
    }
  }

  const handleMarkNotificationRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('teacher_notifications')
        .update({ is_read: true })
        .eq('id', notificationId)

      if (error) throw error

      setNotifications(notifications.map(n =>
        n.id === notificationId
          ? { ...n, is_read: true }
          : n
      ))
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

    const handleChangePassword = async () => {
    const currentPassword = passwordForm.currentPassword.trim()
    const newPassword = passwordForm.newPassword.trim()
    const confirmPassword = passwordForm.confirmPassword.trim()

    if (!currentPassword || !newPassword || !confirmPassword) {
      alert('Please fill in all password fields')
      return
    }

    if (newPassword.length < 8) {
      alert('New password must be at least 8 characters long')
      return
    }

    if (newPassword !== confirmPassword) {
      alert('New password and confirmation do not match')
      return
    }

    setChangingPassword(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile?.email || '',
        password: currentPassword
      })

      if (signInError) {
        throw signInError
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword })

      if (error) throw error

      alert('Password updated successfully')
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error: any) {
      console.error('Error changing password:', error)
      alert(error.message || 'Failed to update password')
    } finally {
      setChangingPassword(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading profile...</div>
  }

  if (!profile) {
    return <div className="text-center py-12">Profile not found</div>
  }

  const isAdmin = profile.has_admin_access || profile.is_super_admin
  const isTeacher = profile.teacher_id !== null

  return (
    <div className="px-4 py-6 sm:px-0 space-y-6">
      {/* Profile Header */}
      <div className="bg-white shadow-lg rounded-xl border border-orange-100 p-6">
        <h1 className="text-3xl font-bold text-brand-primary">{profile.full_name || profile.username || 'User'}</h1>
        <div className="mt-4 space-y-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <p className="text-gray-900">{profile.email}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Organisation</label>
            <p className="text-gray-900">{organisation?.name || 'Not assigned'}</p>
          </div>
        </div>
      </div>

      {/* Teacher Management Section (Admin Only) */}
      {isAdmin && (
        <div className="bg-white shadow-lg rounded-xl border border-orange-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Teacher Management</h3>
            <button
              onClick={() => {
                setTeacherForm({ full_name: '', email: '', phone: '', address: '', subjects: '', password: '', has_admin_access: false })
                setShowAddTeacher(true)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark transition-colors text-sm font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Teacher
            </button>
          </div>

          {teachers.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No teachers found</p>
          ) : (
            <div className="space-y-2">
              {teachers.map((teacher) => (
                <div
                  key={teacher.id}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-brand-primary transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{teacher.full_name || teacher.email}</h4>
                      <div className="mt-1 text-sm text-gray-600 space-y-1">
                        {teacher.email && <p>Email: {teacher.email}</p>}
                        {teacher.phone && <p>Phone: {teacher.phone}</p>}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedTeacher(teacher)
                        setTeacherForm({
                          full_name: teacher.full_name,
                          email: teacher.email || '',
                          phone: teacher.phone || '',
                          address: '',
                          subjects: '',
                          password: '',
                          has_admin_access: false
                        })
                        loadTeacherCentres(teacher.id)
                        loadTeacherNotes(teacher.id)
                        setAdminNoteForm({ title: '', note: '' })
                        setShowEditTeacher(true)
                      }}
                      className="ml-4 px-4 py-2 text-sm font-medium text-brand-primary border-2 border-brand-primary rounded-lg hover:bg-orange-50 transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Teacher Modal */}
          {showAddTeacher && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Add New Teacher</h3>
                  <button
                    onClick={() => setShowAddTeacher(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Teacher Name *</label>
                    <input
                      type="text"
                      value={teacherForm.full_name}
                      onChange={(e) => setTeacherForm({ ...teacherForm, full_name: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                      placeholder="Enter teacher name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      value={teacherForm.email}
                      onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                      placeholder="Enter email"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                    <input
                      type="tel"
                      value={teacherForm.phone}
                      onChange={(e) => setTeacherForm({ ...teacherForm, phone: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                      placeholder="Enter phone number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subjects (comma separated)</label>
                    <input
                      type="text"
                      value={teacherForm.subjects}
                      onChange={(e) => setTeacherForm({ ...teacherForm, subjects: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                      placeholder="e.g., Math, Science, English"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Initial Password *</label>
                    <input
                      type="password"
                      value={teacherForm.password}
                      onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                      placeholder="Set initial password"
                    />
                  </div>

                  {/* Assign to Centres */}
                  <div className="pt-2 border-t border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Assign to Centres</label>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {centres.map((centre) => (
                        <label key={centre.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={teacherCentres.includes(centre.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setTeacherCentres([...teacherCentres, centre.id])
                              } else {
                                setTeacherCentres(teacherCentres.filter(id => id !== centre.id))
                              }
                            }}
                            className="rounded border-gray-300 text-brand-primary focus:ring-brand-secondary"
                          />
                          <span className="text-sm text-gray-900">{centre.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Admin Rights Toggle */}
                  <div className="pt-2 border-t border-gray-200">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={teacherForm.has_admin_access}
                        onChange={(e) => setTeacherForm({ ...teacherForm, has_admin_access: e.target.checked })}
                        className="rounded border-gray-300 text-brand-primary focus:ring-brand-secondary w-5 h-5"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900">Give this account admin rights</span>
                        <p className="text-xs text-gray-500">Admin can manage teachers, centres, and classes</p>
                      </div>
                    </label>
                  </div>

                  <div className="flex gap-2 justify-end pt-4">
                    <button
                      onClick={() => {
                        setShowAddTeacher(false)
                        setTeacherCentres([])
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-600 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddTeacher}
                      disabled={savingTeacher || !teacherForm.full_name || !teacherForm.email || !teacherForm.password}
                      className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-lg hover:bg-brand-primary-dark transition-colors disabled:opacity-50"
                    >
                      {savingTeacher ? 'Creating...' : 'Create Teacher'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Edit Teacher Modal */}
          {showEditTeacher && selectedTeacher && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Edit Teacher</h3>
                  <button
                    onClick={() => {
                      setShowEditTeacher(false)
                      setSelectedTeacher(null)
                      setSelectedTeacherNotes([])
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      value={teacherForm.full_name}
                      onChange={(e) => setTeacherForm({ ...teacherForm, full_name: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                      placeholder="Enter full name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={teacherForm.email}
                      onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                      placeholder="Enter email"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={teacherForm.phone}
                      onChange={(e) => setTeacherForm({ ...teacherForm, phone: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                      placeholder="Enter phone"
                    />
                  </div>

                  {/* Reset Password */}
                  <div className="pt-4 border-t border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Reset Password</label>
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-gray-700">
                      <p className="font-medium text-gray-900">Default password: {defaultTeacherPassword}</p>
                      <p className="mt-1 text-xs text-gray-600">
                        Use this if the teacher forgot their password. They can change it after logging in.
                      </p>
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={handleResetTeacherPassword}
                          disabled={resettingPassword}
                          className="px-3 py-2 text-sm font-medium text-yellow-900 bg-yellow-200 rounded-lg hover:bg-yellow-300 transition-colors disabled:opacity-50"
                        >
                          {resettingPassword ? 'Resetting...' : 'Reset to Default Password'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Assign Centres */}
                  <div className="pt-4 border-t border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Assigned Centres</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {centres.map((centre) => {
                        const isAssigned = teacherCentres.includes(centre.id)
                        return (
                          <label key={centre.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isAssigned}
                              onChange={() => handleAssignCentre(selectedTeacher.id, centre.id, isAssigned)}
                              className="rounded border-gray-300 text-brand-primary focus:ring-brand-secondary"
                            />
                            <span className="text-sm text-gray-900">{centre.name}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  {/* Teacher Notes */}
                  <div className="pt-4 border-t border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Teacher Notes</label>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={adminNoteForm.title}
                          onChange={(e) => setAdminNoteForm({ ...adminNoteForm, title: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary text-sm"
                          placeholder="Note title"
                        />
                        <textarea
                          value={adminNoteForm.note}
                          onChange={(e) => setAdminNoteForm({ ...adminNoteForm, note: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary text-sm"
                          placeholder="Write a note for this teacher..."
                        />
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleAddTeacherNote(selectedTeacher.id)}
                            disabled={savingAdminNote || !adminNoteForm.title.trim() || !adminNoteForm.note.trim()}
                            className="px-3 py-2 text-sm font-medium text-white bg-brand-primary rounded-lg hover:bg-brand-primary-dark transition-colors disabled:opacity-50"
                          >
                            {savingAdminNote ? 'Adding...' : 'Add Note'}
                          </button>
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {selectedTeacherNotes.length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-4">No notes yet</p>
                        ) : (
                          selectedTeacherNotes.map((note) => (
                            <div key={note.id} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                              <p className="text-sm font-semibold text-gray-900">{note.title}</p>
                              <p className="text-sm text-gray-700 mt-1">{note.note}</p>
                              <p className="text-xs text-gray-500 mt-2">
                                {new Date(note.created_at).toLocaleString()}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-4">
                    <button
                      onClick={() => {
                        setShowEditTeacher(false)
                        setSelectedTeacher(null)
                        setSelectedTeacherNotes([])
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-600 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleEditTeacher}
                      disabled={savingTeacher || !teacherForm.full_name}
                      className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-lg hover:bg-brand-primary-dark transition-colors disabled:opacity-50"
                    >
                      {savingTeacher ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Centre Management Section (Admin Only) */}
      {isAdmin && (
        <div className="bg-white shadow-lg rounded-xl border border-orange-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Centre Management</h3>
            <button
              onClick={() => {
                setCentreForm({ name: '', address: '', phone: '', email: '' })
                setShowAddCentre(true)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark transition-colors text-sm font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Centre
            </button>
          </div>

          {centres.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No centres found</p>
          ) : (
            <div className="space-y-2">
              {centres.map((centre) => (
                <div
                  key={centre.id}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-brand-primary transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{centre.name}</h4>
                      <div className="mt-1 text-sm text-gray-600 space-y-1">
                        {centre.address && <p>Address: {centre.address}</p>}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedCentre(centre)
                        setCentreForm({
                          name: centre.name,
                          address: centre.address || '',
                          phone: centre.phone || '',
                          email: centre.email || ''
                        })
                        loadCentreNotes(centre.id)
                        setShowEditCentre(true)
                      }}
                      className="ml-4 px-4 py-2 text-sm font-medium text-brand-primary border-2 border-brand-primary rounded-lg hover:bg-orange-50 transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Centre Modal */}
          {showAddCentre && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Add New Centre</h3>
                  <button
                    onClick={() => setShowAddCentre(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input
                      type="text"
                      value={centreForm.name}
                      onChange={(e) => setCentreForm({ ...centreForm, name: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                      placeholder="Enter centre name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <input
                      type="text"
                      value={centreForm.address}
                      onChange={(e) => setCentreForm({ ...centreForm, address: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                      placeholder="Enter address"
                    />
                  </div>
                  <div className="flex gap-2 justify-end pt-4">
                    <button
                      onClick={() => setShowAddCentre(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-600 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddCentre}
                      disabled={savingCentre || !centreForm.name}
                      className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-lg hover:bg-brand-primary-dark transition-colors disabled:opacity-50"
                    >
                      {savingCentre ? 'Adding...' : 'Add Centre'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Edit Centre Modal */}
          {showEditCentre && selectedCentre && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Edit Centre</h3>
                  <button
                    onClick={() => {
                      setShowEditCentre(false)
                      setSelectedCentre(null)
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input
                      type="text"
                      value={centreForm.name}
                      onChange={(e) => setCentreForm({ ...centreForm, name: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                      placeholder="Enter centre name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <input
                      type="text"
                      value={centreForm.address}
                      onChange={(e) => setCentreForm({ ...centreForm, address: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                      placeholder="Enter address"
                    />
                  </div>

                  {/* Centre Notes */}
                  <div className="pt-4 border-t border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Centre Notes</label>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newCentreNote}
                          onChange={(e) => setNewCentreNote(e.target.value)}
                          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary text-sm"
                          placeholder="Add a note..."
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && newCentreNote.trim()) {
                              handleAddCentreNote(selectedCentre.id)
                            }
                          }}
                        />
                        <button
                          onClick={() => handleAddCentreNote(selectedCentre.id)}
                          disabled={!newCentreNote.trim()}
                          className="px-3 py-2 text-sm font-medium text-white bg-brand-primary rounded-lg hover:bg-brand-primary-dark transition-colors disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {centreNotes.map((note) => (
                          <div key={note.id} className="p-2 bg-gray-50 rounded text-sm">
                            <p className="text-gray-900">{note.note}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(note.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-4">
                    <button
                      onClick={() => {
                        setShowEditCentre(false)
                        setSelectedCentre(null)
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-600 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleEditCentre}
                      disabled={savingCentre || !centreForm.name}
                      className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-lg hover:bg-brand-primary-dark transition-colors disabled:opacity-50"
                    >
                      {savingCentre ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Change Password Section (Teacher Only) */}
      {isTeacher && (
        <div className="bg-white shadow-lg rounded-xl border border-orange-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h3>
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                placeholder="Enter current password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                placeholder="Enter new password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                placeholder="Confirm new password"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleChangePassword}
                disabled={
                  changingPassword ||
                  !passwordForm.currentPassword ||
                  !passwordForm.newPassword ||
                  !passwordForm.confirmPassword
                }
                className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-lg hover:bg-brand-primary-dark transition-colors disabled:opacity-50"
              >
                {changingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* My Notes Section (Teacher Only) */}
      {isTeacher && (
        <div className="bg-white shadow-lg rounded-xl border border-orange-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">My Notes</h3>
            <button
              onClick={() => {
                setNoteForm({ title: '', note: '' })
                setShowAddNote(true)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark transition-colors text-sm font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Note
            </button>
          </div>

          {myNotes.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No notes yet</p>
          ) : (
            <div className="space-y-3">
              {myNotes.map((note) => (
                <div key={note.id} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{note.title}</h4>
                      <p className="text-sm text-gray-700 mt-1">{note.note}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {new Date(note.created_at).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="ml-2 text-red-600 hover:text-red-800"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Note Modal */}
          {showAddNote && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 max-w-md w-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Add New Note</h3>
                  <button
                    onClick={() => setShowAddNote(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                    <input
                      type="text"
                      value={noteForm.title}
                      onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                      placeholder="Enter note title"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Note *</label>
                    <textarea
                      value={noteForm.note}
                      onChange={(e) => setNoteForm({ ...noteForm, note: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                      placeholder="Enter note content"
                    />
                  </div>
                  <div className="flex gap-2 justify-end pt-4">
                    <button
                      onClick={() => setShowAddNote(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-600 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddNote}
                      disabled={savingNote || !noteForm.title || !noteForm.note}
                      className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-lg hover:bg-brand-primary-dark transition-colors disabled:opacity-50"
                    >
                      {savingNote ? 'Adding...' : 'Add Note'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Notifications Section (Teacher Only) */}
      {isTeacher && (
        <div className="bg-white shadow-lg rounded-xl border border-orange-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h3>
          {notifications.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No notifications</p>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 rounded-lg border ${
                    notification.is_read
                      ? 'bg-gray-50 border-gray-200'
                      : 'bg-orange-50 border-orange-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">{notification.message}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                    </div>
                    {!notification.is_read && (
                      <button
                        onClick={() => handleMarkNotificationRead(notification.id)}
                        className="ml-2 text-xs text-brand-primary hover:text-brand-primary-dark font-medium"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
