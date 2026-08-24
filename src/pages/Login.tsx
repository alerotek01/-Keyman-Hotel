import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { sendPasswordResetOTP } from '@/lib/email';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Mail, Lock, User } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export default function Login() {
  const navigate = useNavigate();
  const { signIn, signUp, user, loading: authLoading, role } = useAuth();
  const { toast } = useToast();

  // ─── Login/Signup state ───
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  // ─── Forgot password state (separate from login) ───
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState<'email' | 'otp' | 'new_password'>('email');
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // Redirect based on role once auth is resolved
  useEffect(() => {
    if (authLoading || !user || !role) return;
    if (role === 'admin') navigate('/admin', { replace: true });
    else if (role === 'manager') navigate('/manager', { replace: true });
    else if (role === 'guest') navigate('/guest', { replace: true });
    else if (role === 'external_customer') navigate('/external/order', { replace: true });
    else navigate('/staff', { replace: true });
  }, [user, role, authLoading, navigate]);

  // ─── LOGIN / SIGN UP ───
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, fullName);
        if (error) throw error;
        toast({ title: 'Account Created', description: 'Your account has been created successfully.' });
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
        toast({ title: 'Welcome Back', description: 'You have been signed in successfully.' });
      }
    } catch (error: any) {
      const isTimeout = error.name === 'AbortError' || error.message?.includes('abort');
      const isNetwork = error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError');
      let title = 'Login Failed';
      let description = error.message || 'An error occurred. Please try again.';
      if (isTimeout) { title = 'Connection Timeout'; description = 'Could not reach the server. Please check your internet and try again.'; }
      else if (isNetwork) { title = 'Network Error'; description = 'Unable to connect to the server. Please check your internet connection.'; }
      toast({ title, description, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ─── FORGOT PASSWORD: Step 1 — Send OTP ───
  const handleSendResetOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    try {
      const { data: otpResult, error: otpError } = await sb.rpc('generate_and_store_otp', {
        p_email: resetEmail,
        p_purpose: 'password_reset',
      });
      if (otpError || !otpResult?.success) {
        throw new Error(otpResult?.error || 'Failed to generate code');
      }
      // Send OTP via email
      const code = otpResult.code;
      const emailResult = await sendPasswordResetOTP(resetEmail, code);
      if (!emailResult?.success) {
        console.error('[OTP] Email send failed:', emailResult?.error);
        // Still show success — code was generated, user can try again
        toast({ title: 'Code Generated', description: `If ${resetEmail} is valid, you should receive a code shortly.` });
      } else {
        toast({ title: 'Code Sent', description: `A 6-digit code has been sent to ${resetEmail}` });
      }
      setForgotStep('otp');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to send reset code', variant: 'destructive' });
    }
    setResetLoading(false);
  };

  // ─── FORGOT PASSWORD: Step 2 — Verify OTP ───
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    try {
      const { data: result, error } = await sb.rpc('verify_otp_safe', {
        p_email: resetEmail,
        p_code: resetOtp,
        p_purpose: 'password_reset',
      });
      if (error || !result?.success) throw new Error(result?.error || 'Invalid code');
      toast({ title: 'Code Verified', description: 'Now set your new password.' });
      setForgotStep('new_password');
    } catch (error: any) {
      toast({ title: 'Verification Failed', description: error.message || 'Invalid or expired code', variant: 'destructive' });
    }
    setResetLoading(false);
  };

  // ─── FORGOT PASSWORD: Step 3 — Set New Password ───
  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetNewPassword.length < 6) {
      toast({ title: 'Error', description: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    setResetLoading(true);
    try {
      const { data: result, error } = await sb.rpc('reset_password_with_otp', {
        p_email: resetEmail,
        p_new_password: resetNewPassword,
      });
      if (error || !result?.success) throw new Error(result?.error || 'Failed to reset password');
      // Sign in with new password
      const { error: signInError } = await sb.auth.signInWithPassword({
        email: resetEmail,
        password: resetNewPassword,
      });
      toast({ title: 'Password Reset!', description: 'Signing you in...' });
      // Reset form
      setShowForgot(false);
      setForgotStep('email');
      setResetEmail('');
      setResetOtp('');
      setResetNewPassword('');
      setResetConfirmPassword('');
      if (signInError) navigate('/login', { replace: true });
      // If sign-in succeeded, useEffect redirects to dashboard
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to reset password', variant: 'destructive' });
    }
    setResetLoading(false);
  };

  // ─── Reset forgot password flow ───
  const resetForgotFlow = () => {
    setShowForgot(false);
    setForgotStep('email');
    setResetEmail('');
    setResetOtp('');
    setResetNewPassword('');
    setResetConfirmPassword('');
    setResetLoading(false);
  };

  // Show spinner while auth is resolving
  if (!authLoading && user && loading) {
    return (
      <Layout hideFooter>
        <div className="min-h-[100dvh] flex items-center justify-center">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-brass mx-auto" />
            <p className="text-sm text-muted-foreground">Signing in...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout hideFooter>
      <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-cream/40">
        <div className="w-full max-w-md space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="flex items-baseline justify-center gap-1">
              <span className="font-display text-3xl text-charcoal">Keyman</span>
              <span className="text-[10px] font-medium tracking-[0.2em] uppercase text-brass">Hotel</span>
            </div>
            <div className="divider-brass mx-auto" />
            <p className="text-sm text-charcoal/50">
              {showForgot
                ? 'Reset your password'
                : isSignUp
                ? 'Create a new staff account'
                : 'Sign in to the staff portal'
              }
            </p>
          </div>

          {/* ═══════════════════════════════════════════ */}
          {/* FORGOT PASSWORD FLOW                       */}
          {/* ═══════════════════════════════════════════ */}
          {showForgot && (
            <div className="card-warm p-8">
              {/* Step 1: Enter email */}
              {forgotStep === 'email' && (
                <form onSubmit={handleSendResetOTP} className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium tracking-wide uppercase text-charcoal/60">
                      Enter your email to receive a reset code
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-charcoal/30" />
                      <Input
                        type="email"
                        placeholder="you@keymanhotel.com"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        required
                        className="rounded-full border-charcoal/10 focus-visible:ring-brass pl-10"
                        autoFocus
                      />
                    </div>
                  </div>
                  <Button type="submit" variant="brass" className="w-full" disabled={resetLoading || !resetEmail}>
                    {resetLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Send Reset Code'}
                  </Button>
                  <button type="button" onClick={resetForgotFlow} className="w-full text-xs text-charcoal/40 hover:text-charcoal transition-colors flex items-center justify-center gap-1">
                    <ArrowLeft className="h-3 w-3" /> Back to Sign In
                  </button>
                </form>
              )}

              {/* Step 2: Enter OTP code */}
              {forgotStep === 'otp' && (
                <form onSubmit={handleVerifyOTP} className="space-y-5">
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-brass/10 flex items-center justify-center mx-auto">
                      <Mail className="h-6 w-6 text-brass" />
                    </div>
                    <p className="text-sm text-charcoal/60">We sent a 6-digit code to</p>
                    <p className="text-sm font-medium text-charcoal">{resetEmail}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium tracking-wide uppercase text-charcoal/60">
                      Verification Code
                    </Label>
                    <Input
                      type="text"
                      placeholder="000000"
                      value={resetOtp}
                      onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      maxLength={6}
                      className="rounded-full border-charcoal/10 focus-visible:ring-brass text-center text-xl tracking-[0.4em] font-mono"
                      autoFocus
                    />
                  </div>
                  <Button type="submit" variant="brass" className="w-full" disabled={resetLoading || resetOtp.length !== 6}>
                    {resetLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Verify Code'}
                  </Button>
                  <button type="button" onClick={() => { setForgotStep('email'); setResetOtp(''); }} className="w-full text-xs text-charcoal/40 hover:text-charcoal transition-colors flex items-center justify-center gap-1">
                    <ArrowLeft className="h-3 w-3" /> Back to Sign In
                  </button>
                </form>
              )}

              {/* Step 3: Set new password */}
              {forgotStep === 'new_password' && (
                <form onSubmit={handleSetNewPassword} className="space-y-5">
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                      <Lock className="h-6 w-6 text-emerald-600" />
                    </div>
                    <p className="text-sm text-charcoal/60">Code verified! Set your new password.</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium tracking-wide uppercase text-charcoal/60">New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-charcoal/30" />
                      <Input type="password" placeholder="At least 6 characters" value={resetNewPassword} onChange={(e) => setResetNewPassword(e.target.value)} required minLength={6} className="rounded-full border-charcoal/10 focus-visible:ring-brass pl-10" autoFocus />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium tracking-wide uppercase text-charcoal/60">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-charcoal/30" />
                      <Input type="password" placeholder="Re-enter your password" value={resetConfirmPassword} onChange={(e) => setResetConfirmPassword(e.target.value)} required minLength={6} className="rounded-full border-charcoal/10 focus-visible:ring-brass pl-10" />
                    </div>
                  </div>
                  {resetNewPassword && resetConfirmPassword && resetNewPassword !== resetConfirmPassword && (
                    <p className="text-xs text-destructive">Passwords do not match</p>
                  )}
                  <Button type="submit" variant="brass" className="w-full" disabled={resetLoading || !resetNewPassword || !resetConfirmPassword || resetNewPassword !== resetConfirmPassword}>
                    {resetLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Reset Password & Sign In'}
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════ */}
          {/* LOGIN / SIGN UP FORM                       */}
          {/* ═══════════════════════════════════════════ */}
          {!showForgot && (
            <div className="card-warm p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                {isSignUp && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-xs font-medium tracking-wide uppercase text-charcoal/60">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-charcoal/30" />
                      <Input id="fullName" type="text" placeholder="Jane Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="rounded-full border-charcoal/10 focus-visible:ring-brass pl-10" />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-medium tracking-wide uppercase text-charcoal/60">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-charcoal/30" />
                    <Input id="email" type="email" placeholder="you@keymanhotel.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-full border-charcoal/10 focus-visible:ring-brass pl-10" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-medium tracking-wide uppercase text-charcoal/60">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-charcoal/30" />
                    <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="rounded-full border-charcoal/10 focus-visible:ring-brass pl-10" />
                  </div>
                </div>
                <Button type="submit" variant="brass" className="w-full" disabled={loading}>
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isSignUp ? 'Creating...' : 'Signing in...'}</> : isSignUp ? 'Create Account' : 'Sign In'}
                </Button>
              </form>

              <div className="mt-6 space-y-3 text-center">
                {!isSignUp && (
                  <button onClick={() => { setShowForgot(true); setForgotStep('email'); }} className="text-xs text-brass hover:text-brass-dark transition-colors duration-300">
                    Forgot password?
                  </button>
                )}
                <div>
                  <button onClick={() => { setIsSignUp(!isSignUp); resetForgotFlow(); }} className="text-xs text-charcoal/40 hover:text-charcoal transition-colors duration-300">
                    {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Footer links */}
          <div className="text-center space-y-2">
            {!showForgot && (
              <p className="text-xs text-charcoal/30 leading-relaxed">
                {isSignUp ? 'After creating an account, admin access must be granted by an existing administrator.' : ''}
              </p>
            )}
            <Link to="/" className="text-xs text-brass hover:text-brass-dark transition-colors">
              ← Back to Website
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
