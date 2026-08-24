import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

/**
 * Staff invite set-password page.
 * Flow: admin creates user without password → OTP email sent → user enters OTP here → sets password
 *
 * Password resets are now handled on the /login page (OTP-based).
 */
export default function SetPassword() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'otp' | 'password'>('otp');
  const [success, setSuccess] = useState(false);

  // Step 1: Verify OTP
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || otp.length !== 6) return;

    setLoading(true);
    try {
      const { data: result, error } = await sb.rpc('verify_otp_safe', {
        p_email: email,
        p_code: otp,
        p_purpose: 'staff_invite',
      });

      if (error || !result?.success) {
        throw new Error(result?.error || 'Invalid code');
      }

      setOtpVerified(true);
      toast({ title: 'Code Verified', description: 'Now set your password.' });
      setStep('password');
    } catch (err: any) {
      toast({ title: 'Verification Failed', description: err.message || 'Invalid or expired code', variant: 'destructive' });
    }
    setLoading(false);
  };

  // Step 2: Set password
  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { data: result, error } = await sb.rpc('reset_password_with_otp', {
        p_email: email,
        p_new_password: password,
      });
      if (error) throw error;
      if (!result?.success) throw new Error(result?.error || 'Failed to set password');

      // Sign in with the new password
      const { error: signInError } = await sb.auth.signInWithPassword({ email, password });
      if (signInError) {
        toast.success('Password set! Please sign in at /login.');
        setSuccess(true);
        setTimeout(() => { window.location.href = '/login'; }, 1500);
        return;
      }

      toast.success('Password set successfully!');
      setSuccess(true);

      // Route to correct dashboard
      setTimeout(async () => {
        try {
          const { data: userData } = await sb.auth.getUser();
          const uid = userData?.user?.id;
          if (uid) {
            const { data: roleData } = await sb.rpc('get_user_role', { p_user_id: uid });
            const role = roleData || 'staff';
            if (role === 'admin') window.location.href = '/admin';
            else if (role === 'manager') window.location.href = '/manager';
            else window.location.href = '/staff';
          } else {
            window.location.href = '/staff';
          }
        } catch {
          window.location.href = '/staff';
        }
      }, 1500);
    } catch (err: any) {
      toast.error(err.message || 'Failed to set password');
    }
    setLoading(false);
  };

  // Success
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy via-navy/95 to-brass/20 flex items-center justify-center p-4">
        <Card className="bg-white/95 backdrop-blur w-full max-w-md">
          <CardContent className="py-12 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <h2 className="font-display text-xl font-bold">Password Set!</h2>
            <p className="text-muted-foreground text-sm">Redirecting to your dashboard...</p>
            <Loader2 className="h-4 w-4 animate-spin text-brass mx-auto" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy via-navy/95 to-brass/20 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-bold text-white">
            Keyman<span className="text-brass"> Hotel</span>
          </h1>
          <p className="text-white/60 mt-2">Set Your Password</p>
        </div>

        <Card className="bg-white/95 backdrop-blur">
          <CardContent className="py-8 px-8">
            
            {/* Step 1: Enter email + OTP */}
            {step === 'otp' && (
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label>Verification Code</Label>
                  <Input
                    type="text"
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    maxLength={6}
                    className="text-center text-lg tracking-[0.3em] font-mono"
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Check your email for the 6-digit code
                  </p>
                </div>
                <Button type="submit" variant="brass" className="w-full" disabled={loading || !email || otp.length !== 6}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Verify Code'}
                </Button>
              </form>
            )}

            {/* Step 2: Set password */}
            {step === 'password' && (
              <form onSubmit={handleSetPassword} className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">{email}</p>
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      required
                      minLength={6}
                      autoFocus
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Confirm Password</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
                {password && confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-destructive">Passwords do not match</p>
                )}
                <Button type="submit" variant="brass" className="w-full" disabled={loading || !password || !confirmPassword || password !== confirmPassword}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                  Set Password & Continue
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="text-center mt-4">
          <Link to="/login" className="text-xs text-white/40 hover:text-white/60 transition-colors">
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
