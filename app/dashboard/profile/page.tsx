'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface UserProfile {
  id: string
  full_name: string | null
  email: string
  organisation_id: string | null
  has_admin_access: boolean
  is_super_admin: boolean
  teacher_id: string | null
  organisation?: {
    name: string
  }
  teacher?: {
    phone: string | null
    address: string | null
  }
}

interface Teacher {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  address: string | null
  user_id: string | null
}

interface Centre {
  id: string
  name: string
  address: string | null
  phone: string | null
  email: string | null
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [centres, setCentres] = useState<Centre[]>([])
  const [loading, setLoading] = useState(true)
  const [editingContact, setEditingContact] = useState(false)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null)
  const [showAddTeacher, setShowAddTeacher] = useState(false)
  const [showAddCentre, setShowAddCentre] = useState(false)

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        console.log('Auth user:', user)
        if (!user) return

        const { data: profileData, error: profileError } = await supabase
          .from('users')
          .select(`
            id,
            full_name,
            organisation_id,
            has_admin_access,
            is_super_admin,
            teacher_id,
            organisations:organisation_id (name),
            teachers:teacher_id (phone, address)
          `)
          .eq('auth_id', user.id)
          .single()

        console.log('Profile data:', profileData)
        console.log('Profile error:', profileError)

        if (profileData) {
          const formattedProfile = {
            ...profileData,
            email: user.email || '',
            organisation: profileData.organisations,
            teacher: profileData.teachers
          }
          setProfile(formattedProfile)
          setEmail(user.email || '')
          setPhone(profileData.teachers?.phone || '')

          // Fetch teachers if admin
          if ((profileData.has_admin_access || profileData.is_super_admin) && profileData.organisation_id) {
            const { data: teachersData } = await supabase
              .from('teachers')
              .select(`
                id,
                full_name,
                email,
                phone,
                address,
                user_id
              `)
              .eq('organisation_id', profileData.organisation_id)

            if (teachersData) {
              setTeachers(teachersData)
            }

            // Fetch centres
            const { data: centresData } = await supabase
              .from('centres')
              .select('id, name, address, phone, email')
              .eq('organisation_id', profileData.organisation_id)

            if (centresData) {
              setCentres(centresData)
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

  const handleSaveContact = async () => {
    if (!profile) return

    setSaving(true)
    try {
      // Update email in auth if changed
      if (email !== profile.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: email
        })
        if (emailError) throw emailError
      }

      // Update phone in teacher record if user is a teacher
      if (profile.teacher_id && phone !== profile.teacher?.phone) {
        const { error: phoneError } = await supabase
          .from('teachers')
          .update({ phone: phone })
          .eq('id', profile.teacher_id)

        if (phoneError) throw phoneError
      }

      setProfile({
        ...profile,
        email: email,
        teacher: profile.teacher ? { ...profile.teacher, phone: phone } : null
      })
      setEditingContact(false)
      alert('Contact information updated successfully')
    } catch (error) {
      console.error('Error updating contact:', error)
      alert('Failed to update contact information')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading profile...</div>
  }

  if (!profile) {
    return <div className="text-center py-12">Profile not found</div>
  }

  const userRole = profile.is_super_admin
    ? 'Super Administrator'
    : profile.has_admin_access
    ? 'Administrator'
    : profile.teacher_id
    ? 'Teacher'
    : 'User'

  const isAdmin = profile.has_admin_access || profile.is_super_admin

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Profile Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-brand-primary">{profile.full_name || 'User'}</h1>
        <p className="text-sm text-gray-600 mt-1">{userRole}</p>
      </div>

      {/* Teacher Management Section (Admin Only) */}
      {isAdmin && (
        <div className="bg-white shadow-lg rounded-xl border border-orange-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Teacher Management</h3>
            <button
              onClick={() => setShowAddTeacher(true)}
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
                <button
                  key={teacher.id}
                  onClick={() => setSelectedTeacher(teacher)}
                  className="w-full text-left p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-brand-primary transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900">{teacher.full_name}</h4>
                      <div className="flex gap-3 mt-1 text-sm text-gray-600">
                        {teacher.email && <span>{teacher.email}</span>}
                        {teacher.phone && <span>• {teacher.phone}</span>}
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Teacher Details Modal */}
          {selectedTeacher && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 max-w-md w-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Teacher Details</h3>
                  <button
                    onClick={() => setSelectedTeacher(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <p className="text-gray-900">{selectedTeacher.full_name}</p>
                  </div>
                  {selectedTeacher.email && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <p className="text-gray-900">{selectedTeacher.email}</p>
                    </div>
                  )}
                  {selectedTeacher.phone && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <p className="text-gray-900">{selectedTeacher.phone}</p>
                    </div>
                  )}
                  {selectedTeacher.address && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                      <p className="text-gray-900">{selectedTeacher.address}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Add Teacher Modal */}
          {showAddTeacher && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 max-w-md w-full">
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
                <p className="text-sm text-gray-600 mb-4">
                  Feature coming soon: Add new teachers to your organisation.
                </p>
                <button
                  onClick={() => setShowAddTeacher(false)}
                  className="w-full px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Contact Information Section */}
      <div className="bg-white shadow-lg rounded-xl border border-orange-100 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
          {!editingContact ? (
            <button
              onClick={() => setEditingContact(true)}
              className="px-4 py-2 text-sm font-medium text-brand-primary border-2 border-brand-primary rounded-lg hover:bg-orange-50 transition-colors"
            >
              Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditingContact(false)
                  setEmail(profile.email)
                  setPhone(profile.teacher?.phone || '')
                }}
                className="px-4 py-2 text-sm font-medium text-gray-600 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveContact}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-lg hover:bg-brand-primary-dark transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            {editingContact ? (
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
              />
            ) : (
              <p className="text-gray-900">{profile.email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            {editingContact ? (
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                placeholder="Enter phone number"
              />
            ) : (
              <p className="text-gray-900">{profile.teacher?.phone || 'Not set'}</p>
            )}
          </div>
        </div>
      </div>

      {/* All Centres Section (Admin Only) */}
      {isAdmin && (
        <div className="bg-white shadow-lg rounded-xl border border-orange-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">All Centres</h3>
            <button
              onClick={() => setShowAddCentre(true)}
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
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <h4 className="font-semibold text-gray-900">{centre.name}</h4>
                  <div className="mt-1 text-sm text-gray-600 space-y-1">
                    {centre.address && <p>{centre.address}</p>}
                    {centre.phone && <p>Phone: {centre.phone}</p>}
                    {centre.email && <p>Email: {centre.email}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Centre Modal */}
          {showAddCentre && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 max-w-md w-full">
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
                <p className="text-sm text-gray-600 mb-4">
                  Feature coming soon: Add new centres to your organisation.
                </p>
                <button
                  onClick={() => setShowAddCentre(false)}
                  className="w-full px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
