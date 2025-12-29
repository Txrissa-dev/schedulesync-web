'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const ESTIMATED_USERS_OPTIONS = [
  '1–5',
  '6–10',
  '11–25',
  '26–50',
  '51–100',
  '100+'
]

// List of countries
const COUNTRIES = [
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'India',
  'Singapore',
  'Malaysia',
  'Philippines',
  'Indonesia',
  'Thailand',
  'Vietnam',
  'Japan',
  'South Korea',
  'China',
  'Germany',
  'France',
  'Italy',
  'Spain',
  'Netherlands',
  'Belgium',
  'Switzerland',
  'Austria',
  'Sweden',
  'Norway',
  'Denmark',
  'Finland',
  'Ireland',
  'New Zealand',
  'South Africa',
  'Brazil',
  'Mexico',
  'Argentina',
  'Chile',
  'Colombia',
  'Peru',
  'Other'
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSignup, setShowSignup] = useState(false)

  // Signup form state
  const [signupData, setSignupData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    organisationName: '',
    country: '',
    estimatedUsers: ''
  })
  const [signupErrors, setSignupErrors] = useState<Record<string, string>>({})
  const [signupLoading, setSignupLoading] = useState(false)

  useEffect(() => {
    // Check if already logged in
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        window.location.href = '/dashboard'
      }
    }
    checkAuth()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      // Use window.location for a hard redirect to ensure cookies are recognized
      window.location.href = '/dashboard'
    } catch (error: any) {
      setError(error.message || 'An error occurred during login')
      setLoading(false)
    }
  }

  const validateSignupForm = (): boolean => {
    const errors: Record<string, string> = {}

    // Email validation
    if (!signupData.email) {
      errors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupData.email)) {
      errors.email = 'Please enter a valid email address'
    }

    // Password validation
    if (!signupData.password) {
      errors.password = 'Password is required'
    } else if (signupData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters'
    }

    // Confirm password validation
    if (!signupData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password'
    } else if (signupData.password !== signupData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match'
    }

    // Full name validation
    if (!signupData.fullName) {
      errors.fullName = 'Full name is required'
    }

    // Organisation name validation
    if (!signupData.organisationName) {
      errors.organisationName = 'Organisation name is required'
    }

    // Country validation
    if (!signupData.country) {
      errors.country = 'Country is required'
    }

    // Estimated users validation
    if (!signupData.estimatedUsers) {
      errors.estimatedUsers = 'Please select estimated users'
    }

    setSignupErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setSignupLoading(true)
    setSignupErrors({})

    // Validate form
    if (!validateSignupForm()) {
      setSignupLoading(false)
      return
    }

    try {
      // Call the Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('register-org', {
        body: {
          organisation_name: signupData.organisationName,
          country: signupData.country,
          estimated_users: signupData.estimatedUsers,
          full_name: signupData.fullName,
          email: signupData.email,
          password: signupData.password
        }
      })

      if (error) {
        // Handle specific error cases
        if (error.message.includes('Organisation name already taken')) {
          setSignupErrors({ organisationName: 'This organisation name is already taken' })
        } else if (error.message.includes('already has a super admin')) {
          setSignupErrors({ organisationName: 'This organisation already has a super admin' })
        } else {
          setSignupErrors({ general: error.message || 'Failed to create account' })
        }
        setSignupLoading(false)
        return
      }

      // On success, automatically log the user in
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: signupData.email,
        password: signupData.password,
      })

      if (loginError) {
        setSignupErrors({ general: 'Account created but failed to log in. Please try logging in manually.' })
        setSignupLoading(false)
        return
      }

      // Redirect to dashboard
      window.location.href = '/dashboard'
    } catch (error: any) {
      console.error('Signup error:', error)
      setSignupErrors({ general: error.message || 'An error occurred during signup' })
      setSignupLoading(false)
    }
  }

  const handleSignupInputChange = (field: string, value: string) => {
    setSignupData({ ...signupData, [field]: value })
    // Clear error for this field when user starts typing
    if (signupErrors[field]) {
      const newErrors = { ...signupErrors }
      delete newErrors[field]
      setSignupErrors(newErrors)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {/* Login Card */}
        {!showSignup ? (
          <div className="bg-white rounded-2xl shadow-lg border border-orange-100 p-8">
            {/* Logo & Header */}
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <img
                  src="/logo.png"
                  alt="ScheduleSync Logo"
                  className="h-24 w-auto"
                />
              </div>
              <p className="text-gray-600 text-sm">
                Sign in to your account
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email Field */}
              <div>
                <label
                  htmlFor="email-address"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Email address
                </label>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:border-transparent transition-all"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {/* Password Field */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Password
                  </label>
                  <a href="#" className="text-sm text-brand-secondary hover:text-brand-secondary-dark transition-colors">
                    Forgot password?
                  </a>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:border-transparent transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-6 bg-brand-primary hover:bg-brand-primary-dark text-white font-semibold py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  'Sign in'
                )}
              </button>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or</span>
                </div>
              </div>

              {/* Create Organisation Account Button */}
              <button
                type="button"
                onClick={() => setShowSignup(true)}
                className="w-full bg-white hover:bg-gray-50 text-brand-primary font-semibold py-3 px-4 rounded-lg border-2 border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 transition-all"
              >
                Create organisation account
              </button>
            </form>
          </div>
        ) : (
          /* Super Admin Sign Up Form */
          <div className="bg-white rounded-2xl shadow-lg border border-orange-100 p-8 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-brand-primary">Create Organisation Account</h2>
              <p className="text-gray-600 text-sm mt-2">
                Set up your organisation and super admin account
              </p>
            </div>

            {/* General Error Message */}
            {signupErrors.general && (
              <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
                <p className="text-sm text-red-800">{signupErrors.general}</p>
              </div>
            )}

            {/* Signup Form */}
            <form onSubmit={handleSignup} className="space-y-6">
              {/* Account Credentials Section */}
              <div className="border-b border-gray-200 pb-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Account Credentials</h3>

                <div className="space-y-4">
                  {/* Email */}
                  <div>
                    <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email address *
                    </label>
                    <input
                      id="signup-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      className={`w-full px-4 py-2 rounded-lg border ${
                        signupErrors.email ? 'border-red-300' : 'border-gray-300'
                      } bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-secondary transition-all`}
                      placeholder="admin@example.com"
                      value={signupData.email}
                      onChange={(e) => handleSignupInputChange('email', e.target.value)}
                    />
                    {signupErrors.email && (
                      <p className="mt-1 text-sm text-red-600">{signupErrors.email}</p>
                    )}
                  </div>

                  {/* Password */}
                  <div>
                    <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700 mb-1">
                      Password *
                    </label>
                    <input
                      id="signup-password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      className={`w-full px-4 py-2 rounded-lg border ${
                        signupErrors.password ? 'border-red-300' : 'border-gray-300'
                      } bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-secondary transition-all`}
                      placeholder="••••••••"
                      value={signupData.password}
                      onChange={(e) => handleSignupInputChange('password', e.target.value)}
                    />
                    {signupErrors.password && (
                      <p className="mt-1 text-sm text-red-600">{signupErrors.password}</p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label htmlFor="signup-confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm password *
                    </label>
                    <input
                      id="signup-confirm-password"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      className={`w-full px-4 py-2 rounded-lg border ${
                        signupErrors.confirmPassword ? 'border-red-300' : 'border-gray-300'
                      } bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-secondary transition-all`}
                      placeholder="••••••••"
                      value={signupData.confirmPassword}
                      onChange={(e) => handleSignupInputChange('confirmPassword', e.target.value)}
                    />
                    {signupErrors.confirmPassword && (
                      <p className="mt-1 text-sm text-red-600">{signupErrors.confirmPassword}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Personal Information Section */}
              <div className="border-b border-gray-200 pb-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Personal Information</h3>

                <div>
                  <label htmlFor="signup-full-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Full name *
                  </label>
                  <input
                    id="signup-full-name"
                    name="fullName"
                    type="text"
                    autoComplete="name"
                    className={`w-full px-4 py-2 rounded-lg border ${
                      signupErrors.fullName ? 'border-red-300' : 'border-gray-300'
                    } bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-secondary transition-all`}
                    placeholder="John Doe"
                    value={signupData.fullName}
                    onChange={(e) => handleSignupInputChange('fullName', e.target.value)}
                  />
                  {signupErrors.fullName && (
                    <p className="mt-1 text-sm text-red-600">{signupErrors.fullName}</p>
                  )}
                </div>
              </div>

              {/* Organisation Information Section */}
              <div className="pb-2">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Organisation Information</h3>

                <div className="space-y-4">
                  {/* Organisation Name */}
                  <div>
                    <label htmlFor="signup-org-name" className="block text-sm font-medium text-gray-700 mb-1">
                      Organisation name *
                    </label>
                    <input
                      id="signup-org-name"
                      name="organisationName"
                      type="text"
                      className={`w-full px-4 py-2 rounded-lg border ${
                        signupErrors.organisationName ? 'border-red-300' : 'border-gray-300'
                      } bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-secondary transition-all`}
                      placeholder="Acme Corporation"
                      value={signupData.organisationName}
                      onChange={(e) => handleSignupInputChange('organisationName', e.target.value)}
                    />
                    {signupErrors.organisationName && (
                      <p className="mt-1 text-sm text-red-600">{signupErrors.organisationName}</p>
                    )}
                  </div>

                  {/* Country */}
                  <div>
                    <label htmlFor="signup-country" className="block text-sm font-medium text-gray-700 mb-1">
                      Country *
                    </label>
                    <select
                      id="signup-country"
                      name="country"
                      className={`w-full px-4 py-2 rounded-lg border ${
                        signupErrors.country ? 'border-red-300' : 'border-gray-300'
                      } bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-secondary transition-all`}
                      value={signupData.country}
                      onChange={(e) => handleSignupInputChange('country', e.target.value)}
                    >
                      <option value="">Select a country</option>
                      {COUNTRIES.map((country) => (
                        <option key={country} value={country}>
                          {country}
                        </option>
                      ))}
                    </select>
                    {signupErrors.country && (
                      <p className="mt-1 text-sm text-red-600">{signupErrors.country}</p>
                    )}
                  </div>

                  {/* Estimated Users */}
                  <div>
                    <label htmlFor="signup-estimated-users" className="block text-sm font-medium text-gray-700 mb-1">
                      Estimated users *
                    </label>
                    <select
                      id="signup-estimated-users"
                      name="estimatedUsers"
                      className={`w-full px-4 py-2 rounded-lg border ${
                        signupErrors.estimatedUsers ? 'border-red-300' : 'border-gray-300'
                      } bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-secondary transition-all`}
                      value={signupData.estimatedUsers}
                      onChange={(e) => handleSignupInputChange('estimatedUsers', e.target.value)}
                    >
                      <option value="">Select estimated users</option>
                      {ESTIMATED_USERS_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    {signupErrors.estimatedUsers && (
                      <p className="mt-1 text-sm text-red-600">{signupErrors.estimatedUsers}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowSignup(false)
                    setSignupData({
                      email: '',
                      password: '',
                      confirmPassword: '',
                      fullName: '',
                      organisationName: '',
                      country: '',
                      estimatedUsers: ''
                    })
                    setSignupErrors({})
                  }}
                  className="flex-1 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-4 rounded-lg border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-all"
                >
                  Back to login
                </button>
                <button
                  type="submit"
                  disabled={signupLoading}
                  className="flex-1 bg-brand-primary hover:bg-brand-primary-dark text-white font-semibold py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
                >
                  {signupLoading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </span>
                  ) : (
                    'Create account'
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-600">
          Internal use only - Authorized personnel
        </p>
      </div>
    </div>
  )
}
