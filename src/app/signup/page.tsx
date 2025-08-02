'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { EMAIL_CONFIG } from '@/config/email';

type Role = 'customer' | 'owner';

// Add this function to check password strength
const isPasswordStrong = (password: string) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    return (
        password.length >= minLength &&
        hasUpperCase &&
        hasLowerCase &&
        hasNumbers &&
        hasSpecialChars
    );
};

export default function SignupPage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<Role>('customer');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [rateLimitRemaining, setRateLimitRemaining] = useState<number>(10);
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otp, setOtp] = useState('');
  const [signupMethod, setSignupMethod] = useState<'email' | 'phone'>('email');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [linkMethod, setLinkMethod] = useState<'chatId' | 'username'>('chatId');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  useEffect(() => {
    if (searchParams) {
      const roleParam = searchParams.get('role');
      if (roleParam === 'owner') {
        setRole('owner');
      }
    }
  }, [searchParams]);

  // Check username availability
  const checkUsernameAvailability = async (username: string) => {
    if (!username.trim()) {
      setUsernameAvailable(null);
      return;
    }

    setCheckingUsername(true);
    try {
      const cleanUsername = username.replace('@', '');
      const response = await fetch(`/api/telegram/link-account-by-username?username=${encodeURIComponent(cleanUsername)}`);
      const data = await response.json();
      
      if (response.ok) {
        setUsernameAvailable(data.available);
      } else {
        setUsernameAvailable(false);
      }
    } catch (error) {
      console.error('Error checking username availability:', error);
      setUsernameAvailable(false);
    } finally {
      setCheckingUsername(false);
    }
  };

  // Debounced username check
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (telegramUsername.trim()) {
        checkUsernameAvailability(telegramUsername);
      } else {
        setUsernameAvailable(null);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [telegramUsername]);

  // Helper to format phone number (ensure E.164, avoid double country code)
  const formatPhone = (input: string) => {
    let phone = input.trim();
    if (phone.startsWith('+')) {
      return phone;
    }
    // Remove any leading country code without '+'
    if (phone.startsWith('251')) {
      phone = '+' + phone;
      return phone;
    }
    // Default to Ethiopia if starts with 0
    if (phone.startsWith('0')) {
      phone = '+251' + phone.slice(1);
      return phone;
    }
    // Otherwise, assume it's a local number and prepend +251
    return '+251' + phone;
  };

  // Helper to validate phone number
  const isValidPhone = (phone: string) => {
    const formatted = formatPhone(phone);
    // Ethiopia: +2519XXXXXXXX (12 digits)
    if (formatted.startsWith('+251')) {
      return /^\+2519\d{8}$/.test(formatted);
    }
    // Basic E.164 check for other countries: +[country][number] (10-15 digits)
    return /^\+\d{10,15}$/.test(formatted);
  };

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPasswordError(null);

    try {
      // Add rate limit check
      const storedAttempts = localStorage.getItem('signupAttempts');
      const attempts = storedAttempts ? JSON.parse(storedAttempts) : { count: 0, timestamp: Date.now() };
      
      // Reset attempts if more than an hour has passed
      if (Date.now() - attempts.timestamp > 3600000) {
        attempts.count = 0;
        attempts.timestamp = Date.now();
      }

      if (attempts.count >= 10) {
        setError('Too many signup attempts. Please try again in an hour.');
        return;
      }

      // Validate role
      if (role !== 'customer' && role !== 'owner') {
        setError('Invalid role selected');
        return;
      }

      // Check if the email already exists
      const { data: existingUser, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (userError && userError.code !== 'PGRST116') {
        console.error('Error checking existing user:', userError);
        throw userError;
      }

      if (existingUser) {
        setError('An account with this email already exists. Please log in instead.');
        return;
      }

      // Sign up with Supabase Auth with explicitly set non-admin values
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
          data: {
            full_name: fullName,
            role: role as Role, // Type assertion to ensure only valid roles
            email_sender: EMAIL_CONFIG.SIGNUP,
            email_name: 'Avrio',
            is_admin: false, // Explicitly set to false
            is_verified: false,
            verification_status: 'pending',
            subscription_plan: 'basic'
          }
        }
      });

      if (signUpError) {
        // Handle rate limit error specifically
        if (signUpError.message.includes('rate limit')) {
          setError('Too many signup attempts. Please try again in an hour.');
          return;
        }
        throw signUpError;
      }

      if (data.user) {
        // Update attempts counter
        attempts.count += 1;
        localStorage.setItem('signupAttempts', JSON.stringify(attempts));

        console.log('Signup successful:', {
          userId: data.user.id,
          email: data.user.email,
          metadata: data.user.user_metadata
        });

        // Update the existing user record instead of creating a new one
        const { error: updateError } = await supabase
          .from('users')
          .update({
            full_name: fullName,
            role: role,
            email: email
          })
          .eq('id', data.user.id);

        // If Telegram linking is provided, link it directly
        if (linkMethod === 'chatId' && telegramChatId.trim()) {
          try {
            console.log('Signup - Attempting to link Telegram account directly via Chat ID');
            
            const response = await fetch('/api/telegram/link-account-direct', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId: data.user.id,
                chatId: telegramChatId.trim()
              }),
            });

            const responseData = await response.json();
            console.log('Signup - Direct Telegram link response:', responseData);

            if (response.ok) {
              console.log('Signup - Telegram account linked successfully during signup');
            } else {
              console.error('Signup - Failed to link Telegram account:', responseData);
            }
          } catch (telegramError) {
            console.error('Error linking Telegram account during signup:', telegramError);
            // Don't fail the signup if Telegram linking fails
          }
        } else if (linkMethod === 'username' && telegramUsername.trim()) {
          try {
            console.log('Signup - Attempting to link Telegram account directly via Username');
            
            const cleanUsername = telegramUsername.replace('@', '');
            const response = await fetch('/api/telegram/link-account-by-username', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId: data.user.id,
                username: cleanUsername
              }),
            });

            const responseData = await response.json();
            console.log('Signup - Direct Telegram username link response:', responseData);

            if (response.ok) {
              console.log('Signup - Telegram account linked successfully during signup');
            } else {
              console.error('Signup - Failed to link Telegram account:', responseData);
            }
          } catch (telegramError) {
            console.error('Error linking Telegram account during signup:', telegramError);
            // Don't fail the signup if Telegram linking fails
          }
        }

        if (updateError && updateError.code !== '23505') { // Ignore duplicate key errors
          console.error('Error updating user profile:', updateError);
          throw updateError;
        }

        setMessage('Account created successfully! Please check your email for verification.');
        
        setTimeout(() => {
          router.push('/auth/verify-email');
        }, 2000);
      }
    } catch (error) {
      console.error('Signup process error:', error);
      
      // Handle different types of errors
      if (error instanceof Error) {
        if (error.message.includes('rate limit')) {
          setError('Too many signup attempts. Please try again in an hour.');
        } else if (error.message.includes('duplicate key value')) {
          setMessage('Account created successfully! Please check your email for verification.');
          setTimeout(() => {
            router.push('/auth/verify-email');
          }, 2000);
        } else {
          setError(error.message);
        }
      } else {
        setError('An error occurred during signup');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const formattedPhone = formatPhone(phone);
      // Validate phone number before proceeding
      if (!isValidPhone(phone)) {
        setError('Please enter a valid phone number in international format. For Ethiopia: +2519XXXXXXXX');
        setLoading(false);
        return;
      }
      // Check if phone already exists
      const { data: existingPhone, error: phoneError } = await supabase
        .from('users')
        .select('id')
        .eq('phone', formattedPhone)
        .single();
      if (phoneError && phoneError.code !== 'PGRST116') {
        throw phoneError;
      }
      if (existingPhone) {
        setError('An account with this phone number already exists.');
        setLoading(false);
        return;
      }
      const { data, error: otpError } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      });
      if (otpError) throw otpError;
      setOtpSent(true);
      setMessage('OTP sent! Please check your phone.');
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setVerifyingOtp(true);
    setError(null);
    setMessage(null);
    try {
      const formattedPhone = formatPhone(phone);
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otp,
        type: 'sms',
      });
      if (verifyError) throw verifyError;
      // Upsert user profile in users table with phone_verified true
      if (data.user) {
        // Use the user's id to generate a simple email if not present
        let generatedEmail = data.user.email;
        if (!generatedEmail) {
          const idPart = data.user.id ? data.user.id.slice(0, 4) : Math.random().toString(36).slice(2, 6);
          generatedEmail = `user_${idPart}@phone.avrioxshop.com`;
        }
        await supabase.from('users').upsert({
          id: data.user.id,
          full_name: fullName,
          role: 'customer',
          phone: formattedPhone,
          phone_verified: true,
          email: generatedEmail,
        });
      }
      setMessage('Signup successful! You are now logged in.');
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to verify OTP');
    } finally {
      setVerifyingOtp(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-pink-50">
      {/* Decorative Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute -bottom-32 left-0 w-96 h-96 bg-pink-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 right-1/3 w-96 h-96 bg-yellow-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          {/* Logo or Brand Icon */}
          <div className="mx-auto w-24 h-24 bg-gradient-to-tr from-red-500 to-pink-500 rounded-xl shadow-2xl transform rotate-6 mb-8">
            <div className="w-full h-full bg-white rounded-xl transform -rotate-6 flex items-center justify-center">
              <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
          </div>

          <h2 className="mt-6 text-center text-3xl font-extrabold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Join our marketplace as a customer or business owner
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white/70 backdrop-blur-xl py-8 px-4 shadow-2xl sm:rounded-2xl sm:px-10 border border-gray-100">
            {error && (
              <div className="mb-6 rounded-xl bg-red-50 p-4">
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

            {message && (
              <div className="mb-4 rounded-md bg-green-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-green-800">{message}</p>
                  </div>
                </div>
              </div>
            )}

            {rateLimitRemaining < 3 && (
              <div className="mb-4 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                <p className="text-sm text-yellow-700">
                  Warning: You have {rateLimitRemaining} signup attempts remaining. Please wait an hour if you reach the limit.
                </p>
              </div>
            )}

            {/* Only show signup method toggle for buyers */}
            {role === 'customer' && (
              <div className="mb-6 flex justify-center">
                <div className="inline-flex rounded-full bg-gray-100 p-1 shadow-inner border border-gray-200">
                  <button
                    type="button"
                    className={`px-6 py-2 rounded-full text-sm font-semibold focus:outline-none transition-all duration-200
                      ${signupMethod === 'email' ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-md' : 'bg-transparent text-gray-700 hover:text-red-600'}`}
                    onClick={() => setSignupMethod('email')}
                    aria-pressed={signupMethod === 'email'}
                  >
                    Sign up with Email
                  </button>
                  <button
                    type="button"
                    className={`px-6 py-2 rounded-full text-sm font-semibold focus:outline-none transition-all duration-200
                      ${signupMethod === 'phone' ? 'bg-gradient-to-r from-gray-400 to-gray-300 text-white shadow-md' : 'bg-transparent text-gray-400 cursor-not-allowed'}`}
                    onClick={() => setSignupMethod('phone')}
                    aria-pressed={signupMethod === 'phone'}
                    disabled
                  >
                    Sign up with Phone
                    <span className="ml-2 inline-block bg-yellow-200 text-yellow-800 text-xs font-semibold px-2 py-0.5 rounded-full align-middle">Upcoming</span>
                  </button>
                </div>
              </div>
            )}

            {/* Render the correct form based on role and signup method */}
            {role === 'customer' && signupMethod === 'phone' ? (
              <div className="mb-6 text-center">
                <div className="inline-block bg-yellow-100 text-yellow-800 px-4 py-2 rounded-xl font-semibold text-sm shadow border border-yellow-200">
                  Phone signup is <span className="font-bold">coming soon</span>! Please use email signup for now.
                </div>
              </div>
            ) : (
              // Email signup (for sellers, or buyers if they choose email)
              <form className="space-y-6" onSubmit={handleSignup}>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    I want to
                  </label>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRole('customer')}
                      className={`${
                        role === 'customer'
                          ? 'border-red-500 ring-2 ring-red-500 bg-red-50'
                          : 'border-gray-300 hover:border-red-400 hover:bg-red-50'
                      } relative rounded-xl border px-4 py-3 shadow-sm focus:outline-none transition-all duration-200`}
                    >
                      <span className="flex items-center justify-center text-sm font-medium text-gray-900">
                        <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                        Shop Products
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('owner')}
                      className={`${
                        role === 'owner'
                          ? 'border-red-500 ring-2 ring-red-500 bg-red-50'
                          : 'border-gray-300 hover:border-red-400 hover:bg-red-50'
                      } relative rounded-xl border px-4 py-3 shadow-sm focus:outline-none transition-all duration-200`}
                    >
                      <span className="flex items-center justify-center text-sm font-medium text-gray-900">
                        <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        Sell Products
                      </span>
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                    Full Name
                  </label>
                  <div className="mt-1 relative">
                    <input
                      id="fullName"
                      name="fullName"
                      type="text"
                      required
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                </div>
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
                  <div className="mt-1 relative">
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                  </div>
                  {passwordError && (
                      <p className="mt-2 text-sm text-red-600">{passwordError}</p>
                  )}
                </div>
                
                {/* Optional Telegram Integration */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    <span className="flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.69-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.27-.48.74-.74 2.87-1.25 4.79-2.09 5.76-2.51 2.7-1.18 3.26-1.38 3.64-1.39.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                      </svg>
                      Telegram Integration (Optional)
                    </span>
                  </label>
                  
                  {/* Link Method Selection */}
                  <div className="mb-3">
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="linkMethod"
                          value="chatId"
                          checked={linkMethod === 'chatId'}
                          onChange={(e) => setLinkMethod(e.target.value as 'chatId' | 'username')}
                          className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
                        />
                        <span className="ml-2 text-sm text-gray-700">Chat ID</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="linkMethod"
                          value="username"
                          checked={linkMethod === 'username'}
                          onChange={(e) => setLinkMethod(e.target.value as 'chatId' | 'username')}
                          className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
                        />
                        <span className="ml-2 text-sm text-gray-700">Username</span>
                      </label>
                    </div>
                  </div>

                  {/* Chat ID Input */}
                  {linkMethod === 'chatId' && (
                    <div className="relative">
                                          <input
                      id="telegramChatId"
                      name="telegramChatId"
                      type="text"
                      placeholder="e.g., 744335448"
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                      value={telegramChatId}
                      onChange={(e) => {
                        // Only allow numbers
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        setTelegramChatId(value);
                      }}
                      inputMode="numeric"
                      pattern="[0-9]*"
                    />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                  )}

                  {/* Username Input */}
                  {linkMethod === 'username' && (
                    <div className="relative">
                      <input
                        id="telegramUsername"
                        name="telegramUsername"
                        type="text"
                        placeholder="e.g., @username or username"
                        className={`appearance-none block w-full px-3 py-2 border rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm ${
                          usernameAvailable === true ? 'border-green-300 bg-green-50' :
                          usernameAvailable === false ? 'border-red-300 bg-red-50' :
                          'border-gray-300'
                        }`}
                        value={telegramUsername}
                        onChange={(e) => setTelegramUsername(e.target.value)}
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        {checkingUsername ? (
                          <svg className="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : usernameAvailable === true ? (
                          <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : usernameAvailable === false ? (
                          <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </div>
                    </div>
                  )}

                  <p className="mt-1 text-xs text-gray-500">
                    Get instant notifications about orders and deliveries.
                  </p>
                  
                  {/* Mobile-friendly Open Bot button */}
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/telegram/bot-url');
                        const data = await response.json();
                        
                        if (data.success && data.botUrl) {
                          window.open(data.botUrl, '_blank');
                        } else {
                          window.open('https://t.me/Avrioxshop_bot', '_blank');
                        }
                      } catch (error) {
                        window.open('https://t.me/Avrioxshop_bot', '_blank');
                      }
                    }}
                    className="mt-2 w-full bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center space-x-2 text-sm"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.69-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.27-.48.74-.74 2.87-1.25 4.79-2.09 5.76-2.51 2.7-1.18 3.26-1.38 3.64-1.39.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                    </svg>
                    <span>Open Telegram Bot</span>
                  </button>
                  
                  {/* Fallback link in case button doesn't work */}
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Button not working? 
                    <a 
                      href="https://t.me/Avrioxshop_bot" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 ml-1 underline"
                    >
                      Click here to open bot
                    </a>
                  </p>
                  
                  {/* Instructions based on link method */}
                  {linkMethod === 'chatId' && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs text-blue-800 font-medium mb-1">📝 How to get your Chat ID:</p>
                      <ol className="text-xs text-blue-700 space-y-1">
                        <li>1. Click "Open Telegram Bot" above to open the bot</li>
                        <li>2. Send <strong>/start</strong> to the bot</li>
                        <li>3. Send <strong>/myid</strong> to get your Chat ID</li>
                        <li>4. Copy the Chat ID and paste it above</li>
                      </ol>
                    </div>
                  )}
                  
                  {linkMethod === 'username' && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs text-blue-800 font-medium mb-1">📝 Next Step:</p>
                      <p className="text-xs text-blue-700">
                        After signing up, send <strong>"hello"</strong> to the bot to complete the connection
                      </p>
                    </div>
                  )}
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
                        Creating account...
                      </div>
                    ) : (
                      'Create account'
                    )}
                  </button>
                </div>
              </form>
            )}

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">
                    Already have an account?
                  </span>
                </div>
              </div>

              <div className="mt-6">
                <Link
                  href="/login"
                  className="w-full flex justify-center py-2.5 px-4 border-2 border-red-500 rounded-xl shadow-sm text-sm font-medium text-red-600 bg-transparent hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 transform hover:scale-[1.02]"
                >
                  Sign in instead
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 