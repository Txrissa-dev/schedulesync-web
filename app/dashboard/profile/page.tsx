'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface UserProfile {
  id: string
  username: string | null
  email: string
  organisation_id: string | null
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        console.log('Auth user:', user)
        if (!user) return

        const { data: profileData, error: profileError } = await supabase
          .from('users')
          .select('id, username, organisation_id')
          .eq('auth_id', user.id)
          .single()

        console.log('Profile data:', profileData)
        console.log('Profile error:', profileError)

        if (profileData) {
          setProfile({
            ...profileData,
            email: user.email || ''
          })
        }
      } catch (error) {
        console.error('Error fetching profile:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProfileData()
  }, [])

  if (loading) {
    return <div className="text-center py-12">Loading profile...</div>
  }

  if (!profile) {
    return <div className="text-center py-12">Profile not found</div>
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Profile Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-brand-primary">{profile.username || 'User'}</h1>
        <p className="text-sm text-gray-600 mt-1">User Profile</p>
      </div>

      {/* Profile Information */}
      <div className="bg-white shadow-lg rounded-xl border border-orange-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile Information</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <p className="text-gray-900">{profile.username || 'Not set'}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <p className="text-gray-900">{profile.email}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organisation ID</label>
            <p className="text-gray-900">{profile.organisation_id || 'Not assigned'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
