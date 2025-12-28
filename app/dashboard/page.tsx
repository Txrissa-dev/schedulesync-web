'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function DashboardPage() {
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          // TODO: Fetch user role from your database
          // This is a placeholder - you'll need to adjust based on your schema
          setUserRole('admin') // Temporary default
        }
      } catch (error) {
        console.error('Error fetching user role:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserRole()
  }, [])

  if (loading) {
    return <div className="text-center py-12">Loading dashboard...</div>
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">Centres</h3>
            <p className="text-3xl font-bold text-blue-600">0</p>
            <p className="text-sm text-blue-700 mt-2">Active centres</p>
          </div>

          <div className="bg-green-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-green-900 mb-2">Students</h3>
            <p className="text-3xl font-bold text-green-600">0</p>
            <p className="text-sm text-green-700 mt-2">Enrolled students</p>
          </div>

          <div className="bg-purple-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-purple-900 mb-2">Staff</h3>
            <p className="text-3xl font-bold text-purple-600">0</p>
            <p className="text-sm text-purple-700 mt-2">Active staff members</p>
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button className="bg-white border-2 border-blue-500 text-blue-600 rounded-lg p-4 hover:bg-blue-50 transition">
              View Schedules
            </button>
            <button className="bg-white border-2 border-green-500 text-green-600 rounded-lg p-4 hover:bg-green-50 transition">
              Mark Attendance
            </button>
            <button className="bg-white border-2 border-purple-500 text-purple-600 rounded-lg p-4 hover:bg-purple-50 transition">
              Manage Staff
            </button>
            <button className="bg-white border-2 border-orange-500 text-orange-600 rounded-lg p-4 hover:bg-orange-50 transition">
              Reports
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
