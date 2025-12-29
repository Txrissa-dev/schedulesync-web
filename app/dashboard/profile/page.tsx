'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

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

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [fullName, setFullName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: profileData } = await supabase
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

        if (profileData) {
          const formattedProfile = {
            ...profileData,
            email: user.email || '',
            organisation: profileData.organisations,
            teacher: profileData.teachers
          }
          setProfile(formattedProfile)
          setFullName(profileData.full_name || '')
        }
      } catch (error) {
        console.error('Error fetching profile:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [])

  const handleSave = async () => {
    if (!profile) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({ full_name: fullName })
        .eq('id', profile.id)

      if (error) throw error

      setProfile({ ...profile, full_name: fullName })
      setEditing(false)
    } catch (error) {
      console.error('Error updating profile:', error)
      alert('Failed to update profile')
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

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-brand-primary">Profile</h2>
        <p className="text-sm text-gray-600 mt-1">Manage your account settings</p>
      </div>

      <div className="space-y-6">
        {/* Profile Information */}
        <div className="bg-white rounded-xl border border-orange-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 text-sm font-medium text-brand-primary border-2 border-brand-primary rounded-lg hover:bg-orange-50 transition-colors"
              >
                Edit Profile
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditing(false)
                    setFullName(profile.full_name || '')
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-lg hover:bg-brand-primary-dark transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              {editing ? (
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                />
              ) : (
                <p className="text-gray-900">{profile.full_name || 'Not set'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <p className="text-gray-900">{profile.email}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-brand-primary text-white">
                {userRole}
              </span>
            </div>

            {profile.organisation && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Organisation</label>
                <p className="text-gray-900">{profile.organisation.name}</p>
              </div>
            )}

            {profile.teacher && (
              <>
                {profile.teacher.phone && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <p className="text-gray-900">{profile.teacher.phone}</p>
                  </div>
                )}
                {profile.teacher.address && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <p className="text-gray-900">{profile.teacher.address}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Account Security */}
        <div className="bg-white rounded-xl border border-orange-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Security</h3>
          <div className="space-y-3">
            <button className="w-full text-left px-4 py-3 border-2 border-gray-200 rounded-lg hover:border-brand-secondary transition-colors">
              <div className="font-medium text-gray-900">Change Password</div>
              <div className="text-sm text-gray-500">Update your password to keep your account secure</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
