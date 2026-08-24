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
import { Loader2, ArrowLeft, Mail, Lock, User, KeyRound } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export default function Login() {
  const navigate = useNavigate();
  const { signIn, signUp, user, loading: authLoading, role } = useAuth();
  const { toast } = useToast();

  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState<'email' | 'otp' | 'new_password'>('email');
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (authLoading || !user || !role) return;
    if (role === 'admin') navigate('/admin', { replace: true });
    else if (role === 'manager') navigate('/manager', { replace: true });
    else if (role === 'guest') navigate('/guest', { replace: true });
    else if (role === 'external_customer') navigate('/external/order', { replace: true });
    else navigate('/staff', { replace: true });
  }, [user, role, authLoading, navigate]);

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
    } finally { setLoading(false); }
  };

  const handleSendResetOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    try {
      const { data: otpResult, error: otpError } = await sb.rpc('generate_and_store_otp', {
        p_email: resetEmail, p_purpose: 'password_reset',
      });
      if (otpError || !otpResult?.success) throw new Error(otpResult?.error || 'Failed to generate code');
      const emailResult = await sendPasswordResetOTP(resetEmail, otpResult.code);
      toast({
        title: emailResult?.success ? 'Code Sent' : 'Code Generated',
        description: emailResult?.success
          ? `A 6-digit code has been sent to ${resetEmail}`
          : `Code: ${otpResult.code} — if ${resetEmail} is valid, check your email.`,
      });
      setForgotStep('otp');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to send reset code', variant: 'destructive' });
    }
    setResetLoading(false);
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    try {
      const { data: result, error } = await sb.rpc('verify_otp_safe', {
        p_email: resetEmail, p_code: resetOtp, p_purpose: 'password_reset',
      });
      if (error || !result?.success) throw new Error(result?.error || 'Invalid code');
      toast({ title: 'Code Verified', description: 'Now set your new password.' });
      setForgotStep('new_password');
    } catch (error: any) {
      toast({ title: 'Verification Failed', description: error.message || 'Invalid or expired code', variant: 'destructive' });
    }
    setResetLoading(false);
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetNewPassword.length < 6) { toast({ title: 'Error', description: 'Password must be at least 6 characters', variant: 'destructive' }); return; }
    if (resetNewPassword !== resetConfirmPassword) { toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' }); return; }
    setResetLoading(true);
    try {
      const { data: result, error } = await sb.rpc('reset_password_with_otp', { p_email: resetEmail, p_new_password: resetNewPassword });
      if (error || !result?.success) throw new Error(result?.error || 'Failed to reset password');
      const { error: signInError } = await sb.auth.signInWithPassword({ email: resetEmail, password: resetNewPassword });
      toast({ title: 'Password Reset!', description: 'Signing you in...' });
      resetForgotFlow();
      if (signInError) navigate('/login', { replace: true });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to reset password', variant: 'destructive' });
    }
    setResetLoading(false);
  };

  const resetForgotFlow = () => {
    setShowForgot(false);
    setForgotStep('email');
    setResetEmail(''); setResetOtp(''); setResetNewPassword(''); setResetConfirmPassword('');
    setResetLoading(false);
  };

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
      <div className="min-h-[100dvh] flex items-center justify-center p-4 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1a2744 0%, #0f1a2e 40%, #1a2744 100%)' }}>

        {/* Decorative background elements */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 right-0 w-96 h-96 bg-brass rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-brass rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        </div>

        <div className="w-full max-w-md relative z-10 space-y-8">

          {/* Hotel Branding */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brass/10 border border-brass/20 mx-auto">
              <span className="text-2xl">🏨</span>
            </div>
            <div>
              <h1 className="font-display text-4xl font-bold text-white tracking-tight">
                Keyman<span className="text-brass"> Hotel</span>
              </h1>
              <p className="text-white/40 text-sm mt-1 tracking-wide">Mwatate, Taita Hills</p>
            </div>
          </div>

          {/* ═══ FORGOT PASSWORD ═══ */}
          {showForgot && (
            <div className="bg-white/[0.07] backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
              {/* Step 1: Enter email */}
              {forgotStep === 'email' && (
                <form onSubmit={handleSendResetOTP} className="space-y-5">
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 rounded-xl bg-brass/10 flex items-center justify-center mx-auto">
                      <KeyRound className="h-6 w-6 text-brass" />
                    </div>
                    <h2 className="text-white font-display text-xl font-bold">Forgot Password?</h2>
                    <p className="text-white/40 text-sm">Enter your email and we'll send you a reset code</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium tracking-wide uppercase text-white/50">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-white/30" />
                      <Input
                        type="email"
                        placeholder="you@keymanhotel.com"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        required
                        className="rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-brass pl-10 h-12"
                        autoFocus
                      />
                    </div>
                  </div>
                  <Button type="submit" variant="brass" className="w-full h-12 rounded-xl text-base font-semibold" disabled={resetLoading || !resetEmail}>
                    {resetLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Send Reset Code'}
                  </Button>
                  <button type="button" onClick={resetForgotFlow} className="w-full text-sm text-white/30 hover:text-white/60 transition-colors flex items-center justify-center gap-1.5">
                    <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
                  </button>
                </form>
              )}

              {/* Step 2: Enter OTP */}
              {forgotStep === 'otp' && (
                <form onSubmit={handleVerifyOTP} className="space-y-5">
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 rounded-xl bg-brass/10 flex items-center justify-center mx-auto">
                      <Mail className="h-6 w-6 text-brass" />
                    </div>
                    <h2 className="text-white font-display text-xl font-bold">Check Your Email</h2>
                    <p className="text-white/40 text-sm">We sent a 6-digit code to<br/><span className="text-white/70 font-medium">{resetEmail}</span></p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium tracking-wide uppercase text-white/50">Verification Code</Label>
                    <Input
                      type="text"
                      placeholder="000000"
                      value={resetOtp}
                      onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      maxLength={6}
                      className="rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-brass text-center text-2xl tracking-[0.5em] font-mono h-14"
                      autoFocus
                    />
                  </div>
                  <Button type="submit" variant="brass" className="w-full h-12 rounded-xl text-base font-semibold" disabled={resetLoading || resetOtp.length !== 6}>
                    {resetLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Verify Code'}
                  </Button>
                  <button type="button" onClick={() => { setForgotStep('email'); setResetOtp(''); }} className="w-full text-sm text-white/30 hover:text-white/60 transition-colors flex items-center justify-center gap-1.5">
                    <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
                  </button>
                </form>
              )}

              {/* Step 3: Set new password */}
              {forgotStep === 'new_password' && (
                <form onSubmit={handleSetNewPassword} className="space-y-5">
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto">
                      <Lock className="h-6 w-6 text-emerald-400" />
                    </div>
                    <h2 className="text-white font-display text-xl font-bold">Set New Password</h2>
                    <p className="text-white/40 text-sm">Code verified! Create your new password.</p>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium tracking-wide uppercase text-white/50">New Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-white/30" />
                        <Input type="password" placeholder="At least 6 characters" value={resetNewPassword} onChange={(e) => setResetNewPassword(e.target.value)} required minLength={6} className="rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-brass pl-10 h-12" autoFocus />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium tracking-wide uppercase text-white/50">Confirm Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-white/30" />
                        <Input type="password" placeholder="Re-enter your password" value={resetConfirmPassword} onChange={(e) => setResetConfirmPassword(e.target.value)} required minLength={6} className="rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-brass pl-10 h-12" />
                      </div>
                    </div>
                    {resetNewPassword && resetConfirmPassword && resetNewPassword !== resetConfirmPassword && (
                      <p className="text-xs text-red-400">Passwords do not match</p>
                    )}
                  </div>
                  <Button type="submit" variant="brass" className="w-full h-12 rounded-xl text-base font-semibold" disabled={resetLoading || !resetNewPassword || !resetConfirmPassword || resetNewPassword !== resetConfirmPassword}>
                    {resetLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Reset Password & Sign In'}
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* ═══ LOGIN / SIGN UP ═══ */}
          {!showForgot && (
            <div className="bg-white/[0.07] backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
              <div className="text-center mb-6">
                <h2 className="text-white font-display text-xl font-bold">
                  {isSignUp ? 'Create Account' : 'Welcome Back'}
                </h2>
                <p className="text-white/40 text-sm mt-1">
                  {isSignUp ? 'Set up your staff account' : 'Sign in to access your dashboard'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignUp && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium tracking-wide uppercase text-white/50">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-white/30" />
                      <Input id="fullName" type="text" placeholder="Jane Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-brass pl-10 h-12" />
                    </div>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium tracking-wide uppercase text-white/50">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-white/30" />
                    <Input id="email" type="email" placeholder="you@keymanhotel.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-brass pl-10 h-12" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium tracking-wide uppercase text-white/50">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-white/30" />
                    <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-brass pl-10 h-12" />
                  </div>
                </div>

                <Button type="submit" variant="brass" className="w-full h-12 rounded-xl text-base font-semibold mt-2" disabled={loading}>
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isSignUp ? 'Creating...' : 'Signing in...'}</> : isSignUp ? 'Create Account' : 'Sign In'}
                </Button>
              </form>

              <div className="mt-6 space-y-3 text-center">
                {!isSignUp && (
                  <button onClick={() => { setShowForgot(true); setForgotStep('email'); }} className="text-sm text-brass hover:text-brass-dark transition-colors">
                    Forgot password?
                  </button>
                )}
                <div>
                  <button onClick={() => { setIsSignUp(!isSignUp); resetForgotFlow(); }} className="text-sm text-white/30 hover:text-white/60 transition-colors">
                    {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="text-center">
            <Link to="/" className="text-sm text-white/20 hover:text-white/40 transition-colors">
              ← Back to Website
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
// cache bust 1787608143
// deploy 1787609060
