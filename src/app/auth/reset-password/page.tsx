'use client';

import { useState, useEffect } from 'react';
import { createClientComponent } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'react-hot-toast';

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClientComponent();

  useEffect(() => {
    const handleCode = async () => {
      try {
        const code = searchParams?.get('code');
        const type = searchParams?.get('type');

        if (!code || type !== 'recovery') {
          toast.error('Invalid password reset link');
          router.push('/login');
          return;
        }

        // Get the session directly instead of exchanging the code
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
          toast.error('Invalid or expired reset link');
          router.push('/login');
          return;
        }

      } catch (error) {
        console.error('Error processing reset link:', error);
        toast.error('Invalid or expired reset link');
        router.push('/login');
      }
    };

    handleCode();
  }, [searchParams]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (newPassword.length < 8) {
        toast.error('Password must be at least 8 characters long');
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      await supabase.auth.signOut();
      toast.success('Password updated successfully!');
      router.replace('/login?message=Password has been reset. Please sign in with your new password.');
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error('Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-pink-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">Reset Your Password</h2>
          <p className="mt-2 text-sm text-gray-600">
            Please enter your new password below
          </p>
        </div>

        <form onSubmit={handleResetPassword} className="mt-8 space-y-6">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              New Password
            </label>
            <div className="mt-1">
              <input
                id="password"
                name="password"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                placeholder="Enter your new password"
                minLength={8}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 