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

  const switchMode = (mode: 'login' | 'signup' | 'reset') => {
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
    <div className="h-screen w-screen flex items-center justify-center p-4  overflow-hidden  inset-0 bg-gradient-to-br from-purple-100 via-blue-50 to-cyan-50">
      
      {/* Main Auth Card Container */}
      <div className="  bg-white rounded-3xl shadow-2xl overflow-hidden relative max-w-5xl w-full z-10">
        <div className="flex h-[550px]">
          {/* Left Side - Auth Form */}
          <div className="w-full md:w-1/2 p-4 md:p-8 flex flex-col justify-center">
            <div className="w-full max-w-sm mx-auto">
              {/* Logo */}
              <div className="mb-4">
                <div className="flex items-center space-x-2">
                  {/* <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                    <div className="w-3 h-3 bg-white rounded-full"></div>
                  </div> */}
                  <span className="text-black text-xl font-semibold">Precise.ai</span>
                </div>
              </div>

              <div className="mb-4">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {isResetPassword ? 'Reset Password' : (isLogin ? 'Welcome Back!' : 'Create Your Account')}
                </h2>
                <p className="text-gray-500 text-sm">
                  {isResetPassword ? 'Enter your email to reset password' : (isLogin ? 'Please enter log in details below' : 'Please enter your details to create account')}
                </p>
              </div>

              <form onSubmit={handleAuth} className="space-y-3">
                {/* Only show name field for registration */}
                {!isLogin && !isResetPassword && (
                  <div>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="w-full px-4 py-2 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all duration-200 text-gray-900 placeholder-gray-400"
                      placeholder="Full Name"
                    />
                  </div>
                )}

                <div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all duration-200 text-gray-900 placeholder-gray-400"
                    placeholder="Email"
                  />
                </div>

                {/* Don't show password field for reset password */}
                {!isResetPassword && (
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full px-4 py-2 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all duration-200 text-gray-900 placeholder-gray-400 pr-12"
                      placeholder="Password"
                    />
                    <div
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors duration-200 cursor-pointer"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {showPassword ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        )}
                      </svg>
                    </div>
                  </div>
                )}

                {isLogin && (
                  <div className="text-right">
                    <span
                      onClick={() => switchMode('reset')}
                      className="text-sm text-gray-600 hover:text-gray-800 cursor-pointer font-medium"
                    >
                      Forgot password?
                    </span>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                    {error}
                  </div>
                )}

                {message && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
                    {message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-2 px-4 rounded-xl font-medium text-white transition-all duration-200 text-sm ${loading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-800'
                    }`}
                >
                  {loading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading...</span>
                    </div>
                  ) : (
                    isResetPassword ? 'Send Reset Email' : (isLogin ? 'Sign in' : 'Create Account')
                  )}
                </button>
              </form>

              <div className="mt-3 text-center text-gray-500 text-xs">
                or continue
              </div>
              {/* Google Sign In Button */}
              <div className="mt-2">
                <button
                  type="button"
                  className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-xl !bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 text-sm shadow-sm"
                >
                  <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Log in with Google
                </button>
              </div>

              {/* Navigation Links */}
              <div className="mt-4 text-center">
                {isResetPassword ? (
                  <div className="space-y-2">
                    <div>
                      <span
                        onClick={() => switchMode('login')}
                        className="text-gray-600 hover:text-gray-800 cursor-pointer font-bold text-sm"
                      >
                        ← Back to Login
                      </span>
                    </div>
                    <div className="text-gray-400 text-sm">or</div>
                    <div>
                      <span
                        onClick={() => switchMode('signup')}
                        className="text-gray-600 hover:text-gray-800 cursor-pointer font-bold text-sm"
                      >
                        Create New Account
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <span
                      onClick={() => switchMode(isLogin ? 'signup' : 'login')}
                      className="text-black hover:text-gray-700 cursor-pointer font-bold underline"
                    >
                      {isLogin ? 'Sign Up' : 'Sign In'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Side - Illustration (Part of the same card) */}
          <div className="hidden md:flex md:w-1/2 items-center justify-center p-4">
            {/* Illustration Container with margins */}
            <div className="relative w-full h-full max-w-md">
              {/* Dark background with rounded corners and margins */}
              <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl shadow-xl p-8 h-full relative overflow-hidden">
                {/* Geometric background elements */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-8 right-8 w-16 h-16 border border-gray-600 rotate-45"></div>
                  <div className="absolute bottom-8 left-8 w-12 h-12 border border-gray-600 -rotate-12"></div>
                </div>

                {/* Floating geometric shapes */}
                <div className="absolute top-8 right-12 w-2 h-2 bg-yellow-400 rotate-45"></div>
                <div className="absolute bottom-16 left-8 w-3 h-3 bg-green-400 rounded-full"></div>
                <div className="absolute top-20 left-6 w-1.5 h-1.5 bg-green-400 rotate-45"></div>

                {/* Character illustration container */}
                <div className="relative z-10 flex flex-col items-center justify-center h-full py-4">
                  {/* Hexagonal container with character */}
                  <div className="relative mb-3 transform scale-75">
                    {/* Hexagonal background */}
                    <div className="relative bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-400/30 rounded-2xl p-6 backdrop-blur-sm">
                      {/* Purple crystal on top */}
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <div className="w-6 h-6 bg-gradient-to-br from-purple-400 to-purple-600 transform rotate-45 rounded-lg shadow-lg shadow-purple-500/50"></div>
                      </div>

                      {/* 3D Character */}
                      <div className="flex items-center justify-center w-32 h-32">
                        <div className="relative">
                          {/* Character body */}
                          <div className="w-12 h-18 bg-gradient-to-b from-blue-400 to-blue-600 rounded-t-full mx-auto"></div>

                          {/* Character arms */}
                          <div className="absolute top-4 -left-3 w-6 h-2 bg-pink-200 rounded-full transform -rotate-12"></div>
                          <div className="absolute top-4 -right-3 w-6 h-2 bg-pink-200 rounded-full transform rotate-12"></div>

                          {/* Laptop */}
                          <div className="absolute top-6 left-1/2 transform -translate-x-1/2 w-8 h-6 bg-gray-600 rounded-sm">
                            <div className="w-full h-4 bg-gray-700 rounded-t-sm"></div>
                            <div className="absolute top-0.5 left-0.5 w-7 h-3 bg-blue-400 rounded-sm"></div>
                          </div>

                          {/* Character head */}
                          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-8 h-8 bg-gradient-to-b from-pink-200 to-pink-300 rounded-full"></div>

                          {/* Hair */}
                          <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 w-10 h-4 bg-gradient-to-b from-amber-700 to-amber-800 rounded-t-full"></div>
                        </div>
                      </div>

                      {/* Green circle bottom right */}
                      <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-green-400 rounded-full opacity-80"></div>
                      {/* Yellow triangle bottom left */}
                      <div className="absolute -bottom-1 -left-1 w-0 h-0 border-l-3 border-r-3 border-b-4 border-l-transparent border-r-transparent border-b-yellow-400"></div>
                    </div>
                  </div>

                  {/* Text content */}
                  <div className="text-center text-white">
                    <h1 className="text-2xl font-bold mb-2">Cashe</h1>
                    <p className="text-gray-300 text-xs leading-relaxed max-w-xs">
                      Your intelligent assistant
                    </p>
                  </div>

                  {/* Progress dots */}
                  <div className="flex space-x-1.5 mt-4">
                    <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                    <div className="w-1.5 h-1.5 bg-white/40 rounded-full"></div>
                    <div className="w-1.5 h-1.5 bg-white/40 rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
