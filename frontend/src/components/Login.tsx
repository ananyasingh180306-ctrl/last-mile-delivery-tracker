import React, { useState } from 'react';
import axios from 'axios';
import { Mail, Lock, User as UserIcon, Shield, Truck } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (token: string, user: any) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'CUSTOMER' | 'AGENT' | 'ADMIN'>('CUSTOMER');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const url = isRegister
      ? 'http://localhost:5000/api/auth/register'
      : 'http://localhost:5000/api/auth/login';

    const payload = isRegister ? { email, password, role } : { email, password };

    try {
      const response = await axios.post(url, payload);
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      onLoginSuccess(token, user);
    } catch (err: any) {
      setError(
        err.response?.data?.error
          ? typeof err.response.data.error === 'string'
            ? err.response.data.error
            : JSON.stringify(err.response.data.error)
          : 'An error occurred. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-lm-ink p-4">
      <div className="w-full max-w-md bg-lm-steel border border-lm-line rounded-2xl p-8 shadow-xl">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2 text-3xl font-bold lm-display text-white">
            LASTMILE<span className="text-lm-amber">.</span>
          </div>
          <p className="text-lm-fog-dim text-sm mt-1">
            {isRegister ? 'Create an account to start' : 'Sign in to your tracker'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-lm-red/20 border border-lm-red text-red-300 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-lm-fog mb-2">Email Address</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-lm-fog-dim">
                <Mail size={18} />
              </span>
              <input
                type="email"
                required
                className="w-full bg-lm-steel-2 border border-lm-line rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-lm-fog-dim focus:outline-none focus:border-lm-amber"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-lm-fog mb-2">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-lm-fog-dim">
                <Lock size={18} />
              </span>
              <input
                type="password"
                required
                className="w-full bg-lm-steel-2 border border-lm-line rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-lm-fog-dim focus:outline-none focus:border-lm-amber"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {isRegister && (
            <div>
              <label className="block text-sm font-medium text-lm-fog mb-3">Choose Your Role</label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  className={`flex flex-col items-center justify-center p-3 border rounded-xl transition-all ${
                    role === 'CUSTOMER'
                      ? 'border-lm-amber bg-lm-amber/10 text-white'
                      : 'border-lm-line bg-lm-steel-2 text-lm-fog-dim'
                  }`}
                  onClick={() => setRole('CUSTOMER')}
                >
                  <UserIcon size={20} className="mb-1" />
                  <span className="text-xs font-semibold">Customer</span>
                </button>

                <button
                  type="button"
                  className={`flex flex-col items-center justify-center p-3 border rounded-xl transition-all ${
                    role === 'AGENT'
                      ? 'border-lm-amber bg-lm-amber/10 text-white'
                      : 'border-lm-line bg-lm-steel-2 text-lm-fog-dim'
                  }`}
                  onClick={() => setRole('AGENT')}
                >
                  <Truck size={20} className="mb-1" />
                  <span className="text-xs font-semibold">Agent</span>
                </button>

                <button
                  type="button"
                  className={`flex flex-col items-center justify-center p-3 border rounded-xl transition-all ${
                    role === 'ADMIN'
                      ? 'border-lm-amber bg-lm-amber/10 text-white'
                      : 'border-lm-line bg-lm-steel-2 text-lm-fog-dim'
                  }`}
                  onClick={() => setRole('ADMIN')}
                >
                  <Shield size={20} className="mb-1" />
                  <span className="text-xs font-semibold">Admin</span>
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-lm-amber text-lm-ink font-bold py-3 px-4 rounded-lg transition-all hover:bg-opacity-90 disabled:opacity-50"
          >
            {loading ? 'Processing...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-lm-fog-dim border-t border-lm-line pt-6">
          {isRegister ? (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                className="text-lm-amber font-semibold hover:underline"
                onClick={() => setIsRegister(false)}
              >
                Sign In
              </button>
            </p>
          ) : (
            <p>
              Don't have an account?{' '}
              <button
                type="button"
                className="text-lm-amber font-semibold hover:underline"
                onClick={() => setIsRegister(true)}
              >
                Sign Up
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
