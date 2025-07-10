import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { User } from '@supabase/supabase-js';

interface AuthProps {
  onLogin: (user: User) => void;
}

export default function Auth({ onLogin }: AuthProps) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [isLogin, setIsLogin] = useState<boolean>(true)
  const [isResetPassword, setIsResetPassword] = useState<boolean>(false)
  const [name, setName] = useState<string>('')
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [message, setMessage] = useState<string>('')
  const [showPassword, setShowPassword] = useState<boolean>(false)

  useEffect(() => {
    const mode = searchParams.get('mode')
    if (mode === 'register') {
      setIsLogin(false)
    }
  }, [searchParams])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      if (isResetPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/reset-password',
        })
        if (error) throw error
        setMessage('Password reset email sent! Check your inbox.')
      } else if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        if (data.user) {
          onLogin(data.user) // Notify parent component about the login
          navigate('/dashboard')
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name,
              full_name: name // Some apps use full_name instead
            }
          }
        })
        if (error) throw error
        if (data.user) {
          // Debug: Log what was stored
          console.log('User metadata:', data.user.user_metadata)
          
          if (data.user.email_confirmed_at) {
            onLogin(data.user) // Notify parent component about the signup
            navigate('/dashboard')
          } else {
            setMessage('Check your email for the confirmation link!')
          }
        }
      }
    } catch (error: any) {
      if (error.message === 'Invalid login credentials') {
        setError('Invalid email or password. Please check your credentials or sign up if you don\'t have an account.')
      } else {
        setError(error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setError('')
    setMessage('')
    setName('')
    setEmail('')
    setPassword('')
  }

  const switchMode = (mode: 'login' | 'register' | 'reset') => {
    resetForm()
    if (mode === 'reset') {
      setIsResetPassword(true)
      setIsLogin(false)
    } else if (mode === 'login') {
      setIsResetPassword(false)
      setIsLogin(true)
    } else {
      setIsResetPassword(false)
      setIsLogin(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col justify-center px-6 py-12 lg:px-8 bg-gradient-to-b from-purple-900 via-indigo-900 to-black">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-white">
          {isResetPassword ? 'Reset your password' : isLogin ? 'Sign in to your account' : 'Create your account'}
        </h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white px-6 py-8 shadow rounded-xl">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-sm text-red-600 rounded p-3">
              {error}
            </div>
          )}
          
          {message && (
            <div className="mb-4 bg-green-50 border border-green-200 text-sm text-green-600 rounded p-3">
              {message}
            </div>
          )}
          
          <form className="space-y-6" onSubmit={handleAuth}>
            {/* Only show name field for registration */}
            {!isLogin && !isResetPassword && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium leading-6 text-gray-900">
                  Full name
                </label>
                <div className="mt-2">
                  <input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    required={!isLogin && !isResetPassword}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium leading-6 text-gray-900">
                Email address
              </label>
              <div className="mt-2">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                />
              </div>
            </div>

            {/* Don't show password field for reset password */}
            {!isResetPassword && (
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-medium leading-6 text-gray-900">
                    Password
                  </label>
                  {isLogin && (
                    <div className="text-sm">
                      <a 
                        href="#" 
                        onClick={(e) => { e.preventDefault(); switchMode('reset'); }} 
                        className="font-semibold text-indigo-600 hover:text-indigo-500"
                      >
                        Forgot password?
                      </a>
                    </div>
                  )}
                </div>
                <div className="mt-2 relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    required={!isResetPassword}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  />
                  <button 
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-70"
              >
                {loading ? 'Processing...' : isResetPassword ? 'Send reset link' : isLogin ? 'Sign in' : 'Sign up'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-gray-500">
                  {isResetPassword ? 'Remember your password?' : isLogin ? 'New to the platform?' : 'Already have an account?'}
                </span>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={() => switchMode(isResetPassword || isLogin ? 'register' : 'login')}
                className="flex w-full justify-center rounded-md bg-gray-100 px-3 py-1.5 text-sm font-semibold leading-6 text-gray-900 shadow-sm hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600"
              >
                {isResetPassword || isLogin ? 'Create a new account' : 'Sign in to existing account'}
              </button>
              
              {isResetPassword && (
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="flex w-full justify-center rounded-md bg-white mt-2 px-3 py-1.5 text-sm font-semibold leading-6 text-gray-900 shadow-sm border border-gray-300 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600"
                >
                  Back to sign in
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
