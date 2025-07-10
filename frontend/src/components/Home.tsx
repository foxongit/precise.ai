import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User } from '@supabase/supabase-js';

interface HomeProps {
  user: User | null;
}

export default function Home({ user }: HomeProps) {
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false)
  const navigate = useNavigate()

  const handleGetStarted = () => {
    if (user) {
      navigate('/dashboard')
    } else {
      navigate('/auth')
    }
  }

  const handleLogin = () => {
    navigate('/auth')
  }

  const handleRegister = () => {
    navigate('/auth?mode=register')
  }

  const handleLogout = async () => {
    const { supabase } = await import('../lib/supabase')
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-gray-900">FinalRAG</h1>
              </div>
            </div>

            {/* Desktop Navigation - All moved to right */}
            <div className="hidden md:flex items-center space-x-8">
              {/* Navigation Links */}
              <div className="flex items-baseline space-x-8">
                <div className="relative">
                  <button className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center">
                    Services 
                    <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                
                <a href="#features" className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200">
                  Features
                </a>
                
                <a href="#pricing" className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200">
                  Pricing
                </a>
                
                <a href="#contact" className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200">
                  Contact
                </a>
              </div>

              {/* Authentication Buttons */}
              <div className="flex items-center space-x-4">
                {user ? (
                  <>
                    <button 
                      onClick={handleLogout}
                      className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200"
                    >
                      Log out
                    </button>
                    <button
                      onClick={() => navigate('/dashboard')}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200"
                    >
                      Dashboard
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={handleLogin}
                      className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200"
                    >
                      Sign in
                    </button>
                    <button
                      onClick={handleRegister}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200"
                    >
                      Sign up
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
              >
                <span className="sr-only">Open main menu</span>
                <svg className={`${isMenuOpen ? 'hidden' : 'block'} h-6 w-6`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <svg className={`${isMenuOpen ? 'block' : 'hidden'} h-6 w-6`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <div className={`${isMenuOpen ? 'block' : 'hidden'} md:hidden`}>
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <a href="#services" className="text-gray-700 hover:bg-gray-100 block px-3 py-2 rounded-md text-base font-medium">Services</a>
            <a href="#features" className="text-gray-700 hover:bg-gray-100 block px-3 py-2 rounded-md text-base font-medium">Features</a>
            <a href="#pricing" className="text-gray-700 hover:bg-gray-100 block px-3 py-2 rounded-md text-base font-medium">Pricing</a>
            <a href="#contact" className="text-gray-700 hover:bg-gray-100 block px-3 py-2 rounded-md text-base font-medium">Contact</a>
          </div>
          <div className="pt-4 pb-3 border-t border-gray-200">
            <div className="px-2 space-y-1">
              {user ? (
                <>
                  <button
                    onClick={handleLogout}
                    className="text-gray-700 hover:bg-gray-100 block px-3 py-2 rounded-md text-base font-medium w-full text-left"
                  >
                    Log out
                  </button>
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="bg-indigo-600 text-white hover:bg-indigo-700 block px-3 py-2 rounded-md text-base font-medium w-full text-left"
                  >
                    Dashboard
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleLogin}
                    className="text-gray-700 hover:bg-gray-100 block px-3 py-2 rounded-md text-base font-medium w-full text-left"
                  >
                    Sign in
                  </button>
                  <button
                    onClick={handleRegister}
                    className="bg-indigo-600 text-white hover:bg-indigo-700 block px-3 py-2 rounded-md text-base font-medium w-full text-left"
                  >
                    Sign up
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 lg:py-32">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
                <span className="block">Document Analysis with</span>
                <span className="block text-indigo-600">Conversational AI</span>
              </h1>
              <p className="mt-6 text-xl text-gray-500 max-w-3xl">
                Upload your documents and have insightful conversations about their content. Get answers, extract insights, and analyze information with our powerful RAG-based AI assistant.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <button
                  onClick={handleGetStarted}
                  className="flex justify-center items-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 md:py-4 md:text-lg md:px-10 transition-colors duration-200"
                >
                  Get started
                </button>
                <a
                  href="#features"
                  className="flex justify-center items-center px-8 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 md:py-4 md:text-lg md:px-10 transition-colors duration-200"
                >
                  Learn more
                </a>
              </div>
            </div>
            <div className="hidden md:block">
              <img
                className="h-auto w-full max-w-md mx-auto"
                src="/hero-image.svg"
                alt="Document analysis illustration"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <section id="features" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
              Powerful document analysis features
            </h2>
            <p className="mt-4 max-w-2xl text-xl text-gray-500 mx-auto">
              Extract insights, answer questions, and analyze your documents with our AI-powered platform.
            </p>
          </div>
          
          <div className="mt-16">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <div className="w-12 h-12 rounded-md flex items-center justify-center bg-indigo-500 text-white mb-4">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900">Document Upload</h3>
                <p className="mt-2 text-gray-600">
                  Upload PDFs, Word documents, and other file formats for instant analysis by our AI.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <div className="w-12 h-12 rounded-md flex items-center justify-center bg-indigo-500 text-white mb-4">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900">Conversational AI</h3>
                <p className="mt-2 text-gray-600">
                  Ask questions naturally and receive accurate, context-aware responses about your documents.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <div className="w-12 h-12 rounded-md flex items-center justify-center bg-indigo-500 text-white mb-4">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900">Insights Extraction</h3>
                <p className="mt-2 text-gray-600">
                  Automatically identify key information, trends, and insights from your documents.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 max-w-2xl text-xl text-gray-500 mx-auto">
              Choose the plan that fits your needs
            </p>
          </div>
          
          <div className="mt-16 grid grid-cols-1 gap-y-12 md:grid-cols-3 md:gap-x-6">
            {/* Free Plan */}
            <div className="border border-gray-200 p-8 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow duration-300">
              <h3 className="text-lg font-medium text-gray-900">Free</h3>
              <p className="mt-4 text-sm text-gray-500">Perfect for trying out our features</p>
              <p className="mt-8">
                <span className="text-4xl font-extrabold text-gray-900">$0</span>
                <span className="text-base font-medium text-gray-500">/month</span>
              </p>
              <ul className="mt-8 space-y-4 text-sm text-gray-600">
                <li className="flex items-center">
                  <svg className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  5 document uploads per month
                </li>
                <li className="flex items-center">
                  <svg className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  50 AI queries per month
                </li>
                <li className="flex items-center">
                  <svg className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Basic document types
                </li>
              </ul>
              <div className="mt-8">
                <button
                  onClick={handleGetStarted}
                  className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors duration-200"
                >
                  Start for free
                </button>
              </div>
            </div>
            
            {/* Pro Plan */}
            <div className="border-2 border-indigo-500 p-8 rounded-lg bg-white shadow-md hover:shadow-lg transition-shadow duration-300 relative">
              <div className="absolute top-0 inset-x-0 transform -translate-y-1/2">
                <span className="bg-indigo-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                  Popular
                </span>
              </div>
              <h3 className="text-lg font-medium text-gray-900">Pro</h3>
              <p className="mt-4 text-sm text-gray-500">For individuals and small teams</p>
              <p className="mt-8">
                <span className="text-4xl font-extrabold text-gray-900">$29</span>
                <span className="text-base font-medium text-gray-500">/month</span>
              </p>
              <ul className="mt-8 space-y-4 text-sm text-gray-600">
                <li className="flex items-center">
                  <svg className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  50 document uploads per month
                </li>
                <li className="flex items-center">
                  <svg className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Unlimited AI queries
                </li>
                <li className="flex items-center">
                  <svg className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Advanced document types
                </li>
                <li className="flex items-center">
                  <svg className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Chat history saved for 90 days
                </li>
              </ul>
              <div className="mt-8">
                <button
                  onClick={handleGetStarted}
                  className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors duration-200"
                >
                  Start free trial
                </button>
              </div>
            </div>
            
            {/* Enterprise Plan */}
            <div className="border border-gray-200 p-8 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow duration-300">
              <h3 className="text-lg font-medium text-gray-900">Enterprise</h3>
              <p className="mt-4 text-sm text-gray-500">For organizations with advanced needs</p>
              <p className="mt-8">
                <span className="text-4xl font-extrabold text-gray-900">$99</span>
                <span className="text-base font-medium text-gray-500">/month</span>
              </p>
              <ul className="mt-8 space-y-4 text-sm text-gray-600">
                <li className="flex items-center">
                  <svg className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Unlimited document uploads
                </li>
                <li className="flex items-center">
                  <svg className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Unlimited AI queries
                </li>
                <li className="flex items-center">
                  <svg className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  All document types
                </li>
                <li className="flex items-center">
                  <svg className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Chat history saved for 1 year
                </li>
                <li className="flex items-center">
                  <svg className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Priority support
                </li>
              </ul>
              <div className="mt-8">
                <button
                  onClick={handleGetStarted}
                  className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors duration-200"
                >
                  Contact sales
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
              Get in touch
            </h2>
            <p className="mt-4 max-w-2xl text-xl text-gray-500 mx-auto">
              Have questions? We're here to help.
            </p>
          </div>
          
          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <form className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Name
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      name="name"
                      id="name"
                      className="py-3 px-4 block w-full shadow-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 rounded-md"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <div className="mt-1">
                    <input
                      type="email"
                      name="email"
                      id="email"
                      className="py-3 px-4 block w-full shadow-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 rounded-md"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700">
                    Message
                  </label>
                  <div className="mt-1">
                    <textarea
                      id="message"
                      name="message"
                      rows={4}
                      className="py-3 px-4 block w-full shadow-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 rounded-md"
                    ></textarea>
                  </div>
                </div>
                <div>
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center py-3 px-6 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Send message
                  </button>
                </div>
              </form>
            </div>
            
            <div>
              <div className="bg-gray-50 rounded-lg p-8 h-full">
                <h3 className="text-lg font-medium text-gray-900 mb-6">Contact Information</h3>
                
                <div className="space-y-6">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="ml-3 text-gray-700">
                      <p className="text-sm">Email</p>
                      <p className="text-base font-medium">info@finalrag.example.com</p>
                    </div>
                  </div>
                  
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <div className="ml-3 text-gray-700">
                      <p className="text-sm">Phone</p>
                      <p className="text-base font-medium">+1 (555) 123-4567</p>
                    </div>
                  </div>
                  
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="ml-3 text-gray-700">
                      <p className="text-sm">Address</p>
                      <p className="text-base font-medium">123 AI Avenue, San Francisco, CA 94103</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-medium">FinalRAG</h3>
              <p className="mt-2 text-gray-300 text-sm">
                Document analysis with conversational AI
              </p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium uppercase tracking-wider">Solutions</h3>
              <ul className="mt-4 space-y-2">
                <li><a href="#" className="text-gray-300 hover:text-white text-sm">Document Analysis</a></li>
                <li><a href="#" className="text-gray-300 hover:text-white text-sm">AI Assistant</a></li>
                <li><a href="#" className="text-gray-300 hover:text-white text-sm">Data Extraction</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-sm font-medium uppercase tracking-wider">Resources</h3>
              <ul className="mt-4 space-y-2">
                <li><a href="#" className="text-gray-300 hover:text-white text-sm">Documentation</a></li>
                <li><a href="#" className="text-gray-300 hover:text-white text-sm">Blog</a></li>
                <li><a href="#" className="text-gray-300 hover:text-white text-sm">Support</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-sm font-medium uppercase tracking-wider">Legal</h3>
              <ul className="mt-4 space-y-2">
                <li><a href="#" className="text-gray-300 hover:text-white text-sm">Privacy Policy</a></li>
                <li><a href="#" className="text-gray-300 hover:text-white text-sm">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-8 border-t border-gray-700 pt-8 flex flex-col md:flex-row justify-between items-center">
            <div className="text-gray-300 text-sm">
              © 2025 FinalRAG. All rights reserved.
            </div>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="#" className="text-gray-400 hover:text-gray-300">
                <span className="sr-only">Twitter</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-gray-300">
                <span className="sr-only">GitHub</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-gray-300">
                <span className="sr-only">LinkedIn</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" clipRule="evenodd" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
