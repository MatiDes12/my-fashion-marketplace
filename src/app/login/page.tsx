'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { Suspense } from 'react';
import LoadingPage from '@/components/LoadingPage';
import { EMAIL_CONFIG } from '@/config/email';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';

function LoginContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClientComponent();
  const { setUser } = useAuth();
  const returnUrl = searchParams?.get('returnUrl') || null;
  const [forgotPasswordModal, setForgotPasswordModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  useEffect(() => {
    //Check for message in URL
    const urlMessage = searchParams?.get('message');
    if (urlMessage) {
      setMessage(urlMessage);
    }
  }, [searchParams]);

  // Separate session check into its own effect
  useEffect(() => {
    let isSubscribed = true;

    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!isSubscribed || !session) return;

        // Check user role to determine redirect
        const { data: userData } = await supabase
          .from('users')
          .select('role, is_admin')
          .eq('id', session.user.id)
          .single();
          
        if (!isSubscribed) return;

        if (userData?.role === 'admin') {
          router.push('/admin');
        } else if (userData?.role === 'owner') {
          router.push('/dashboard/products');
        } else {
          router.push('/products');
        }
      } catch (error) {
        console.error('Session check error:', error);
      }
    };
    
    checkSession();

    return () => {
      isSubscribed = false;
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (loading) return;

    try {
      setLoading(true);
      setError(null);

      const { data: { session }, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        if (signInError.message.includes('rate limit')) {
          throw new Error('Too many login attempts. Please try again in a few minutes.');
        }
        throw signInError;
      }

      if (!session) {
        throw new Error('Login failed. Please check your credentials and try again.');
      }

      // Check user role
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role, is_admin, is_verified, verification_status')
        .eq('id', session.user.id)
        .single();

      if (userError) throw userError;

      // Update the user in context
      setUser(session.user);

      // Handle redirects based on role and verification status
      if (userData?.role === 'admin') {
        router.push(returnUrl || '/admin');
      } else if (userData?.role === 'owner') {
        if (!userData.is_verified) {
          // Check if verification is pending
          const { data: verificationData } = await supabase
            .from('seller_verification')
            .select('status')
            .eq('user_id', session.user.id)
            .single();

          if (!verificationData) {
            router.push('/dashboard/verify');
          } else if (verificationData.status === 'pending') {
            router.push('/dashboard/verification-pending');
          } else {
            router.push('/dashboard');
          }
        } else {
          router.push('/dashboard');
        }
      } else {
        router.push('/products');
      }

      toast.success('Welcome back!');

    } catch (error) {
      console.error('Login error:', error);
      setError(error instanceof Error ? error.message : 'Login failed');
      toast.error(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    try {
      if (!resetEmail) {
        toast.error('Please enter your email address');
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: 'https://www.avrioxshop.com/auth/reset-password'
      });

      if (error) {
        console.error('Reset email error:', error);
        if (error.message.includes('rate limit')) {
          throw new Error('Too many reset attempts. Please try again later.');
        }
        throw error;
      }

      toast.success('If an account exists with this email, you will receive a password reset link. Please check your inbox and spam folder. The email might take 4-6 minutes to arrive.');
      setForgotPasswordModal(false);
      setResetEmail('');
    } catch (error) {
      console.error('Error sending reset password email:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send reset password email');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-pink-50">
      {/* Decorative Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-0 left-0 w-96 h-96 bg-pink-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-yellow-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          {/* Logo or Brand Icon */}
          <div className="mx-auto w-24 h-24 bg-gradient-to-tr from-red-500 to-pink-500 rounded-xl shadow-2xl transform -rotate-6 mb-8">
            <div className="w-full h-full bg-white rounded-xl transform rotate-6 flex items-center justify-center">
              <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
          </div>

          <h2 className="mt-6 text-center text-3xl font-extrabold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">
            Welcome back
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to your account to continue shopping
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white/70 backdrop-blur-xl py-8 px-4 shadow-2xl sm:rounded-2xl sm:px-10 border border-gray-100">
            {message && (
              <div className="mb-4 rounded-md bg-blue-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-blue-800">{message}</p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-4 rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-800">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <form className="space-y-6" onSubmit={handleLogin}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <div className="mt-1 relative">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="flex items-center justify-between">
                  <div className="mt-1 relative flex-grow">
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setForgotPasswordModal(true)}
                    className="ml-2 text-sm font-medium text-red-600 hover:text-red-500"
                  >
                    Forgot?
                  </button>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 transition-all duration-200 transform hover:scale-[1.02]"
                >
                  {loading ? (
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Signing in...
                    </div>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </div>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">
                    New to our platform?
                  </span>
                </div>
              </div>

              <div className="mt-6">
                <Link
                  href="/signup"
                  className="w-full flex justify-center py-2.5 px-4 border-2 border-red-500 rounded-xl shadow-sm text-sm font-medium text-red-600 bg-transparent hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 transform hover:scale-[1.02]"
                >
                  Create an account
                </Link>
              </div>
            </div>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">
                    Need help? Contact us at{' '}
                    <a 
                      href={`mailto:${EMAIL_CONFIG.SUPPORT}`}
                      className="font-medium text-red-600 hover:text-red-500"
                    >
                      {EMAIL_CONFIG.SUPPORT}
                    </a>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Transition appear show={forgotPasswordModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setForgotPasswordModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                    Reset Password
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Enter your email address and we'll send you instructions to reset your password.
                    </p>
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="mt-4 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-red-500 focus:ring-red-500"
                      placeholder="Enter your email"
                    />
                    <div className="mt-4 text-xs text-gray-600 text-center space-y-2">
                      <p>It might take 4 to 6 minutes for the reset link to arrive in your inbox. Please be patient.</p>
                      <p className="font-medium">የይለፍ ቃል ማደስ አገናኝ ከ 4 እስከ 6 ደቂቃ ያህል ሊወርድ ይችላል። እባክዎ ይጠብቁ።</p>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end space-x-2">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-red-100 px-4 py-2 text-sm font-medium text-red-900 hover:bg-red-200"
                      onClick={handleForgotPassword}
                    >
                      Send Instructions
                    </button>
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      onClick={() => setForgotPasswordModal(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <LoginContent />
    </Suspense>
  );
} 