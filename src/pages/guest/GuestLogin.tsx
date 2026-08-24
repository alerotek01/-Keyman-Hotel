import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Mail, KeyRound, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { sendOTPVerification } from '@/lib/email';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// OTP is now generated server-side via generate_and_store_otp RPC

export default function GuestLogin() {
  const { user, role } = useAuth();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState('');

  // Block staff from accessing guest login
  const staffRoles = ['admin', 'manager', 'receptionist', 'chef', 'waiter', 'housekeeper', 'accountant'];
  if (user && role && staffRoles.includes(role)) {
    const redirectMap: Record<string, string> = {
      admin: '/admin',
      manager: '/manager',
      receptionist: '/staff/reception',
      chef: '/staff/kitchen',
      waiter: '/staff/waiter',
      housekeeper: '/staff/housekeeping',
      accountant: '/admin',
    };
    return <Navigate to={redirectMap[role] || '/staff'} replace />;
  }

  const handleSendOTP = async () => {
    if (!email) { toast.error('Enter your email'); return; }
    setLoading(true);
    try {
      // Check if email is already registered as staff
      const { data: staffUser } = await sb.from('users')
        .select('id, role')
        .eq('email', email)
        .in('role', ['admin', 'manager', 'receptionist', 'chef', 'waiter', 'housekeeper', 'accountant'])
        .single();
      
      if (staffUser) {
        toast.error('This email is registered as staff. Please use the staff login instead.');
        setLoading(false);
        return;
      }

      // Generate OTP server-side (prevents client prediction)
      const { data: otpResult, error: otpError } = await sb.rpc('generate_and_store_otp', {
        p_email: email,
      });

      if (otpError || !otpResult?.success) {
        toast.error(otpResult?.error || 'Failed to generate OTP');
        setLoading(false);
        return;
      }

      const code = otpResult.code;
      setGeneratedOtp(code);

      // Send via Resend
      const guestName = email.split('@')[0];
      const result = await sendOTPVerification(email, code, guestName);
      
      if (result.success) {
        toast.success('OTP sent to your email!');
        setStep('otp');
      } else {
        // Fallback: show OTP on screen for development
        toast.success(`OTP: ${code} (email service unavailable)`);
        setStep('otp');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp) { toast.error('Enter the OTP code'); return; }
    setLoading(true);
    try {
      // Verify OTP server-side (with attempt limiting)
      const { data: verifyResult, error: verifyError } = await sb.rpc('verify_otp_safe', {
        p_email: email,
        p_code: otp,
      });

      if (verifyError || !verifyResult?.success) {
        toast.error(verifyResult?.error || 'Invalid or expired OTP code');
        setLoading(false);
        return;
      }

      // OTP verified — now create Supabase auth session
      // Use signInWithOtp with shouldCreateUser to create/find auth user
      const { error: authError } = await sb.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      // Note: This sends a Supabase OTP email too, but the user already verified via Resend.
      // We use this to establish the Supabase auth session.
      if (authError) {
        // If Supabase OTP fails, use our stored user
        const { data: existingUser } = await sb.from('users').select('id').eq('email', email).eq('role', 'guest').single();
        if (existingUser) {
          // Store user ID in localStorage for session
          localStorage.setItem('guest_user_id', existingUser.id);
          localStorage.setItem('guest_email', email);
        }
      }

      // Create/update users record
      const { data: { user: authUser } } = await sb.auth.getUser();
      const userId = authUser?.id || (await sb.from('users').select('id').eq('email', email).eq('role', 'guest').single())?.data?.id;
      
      if (userId) {
        await sb.from('users').upsert({
          id: userId,
          email: email,
          full_name: email.split('@')[0] || 'Guest',
          role: 'guest',
          is_guest: true,
          is_active: true,
          otp_verified_at: new Date().toISOString(),
        }, { onConflict: 'id' });

        // Ensure guest record exists
        const { data: guestRec } = await sb.from('guests').select('id').eq('user_id', userId).single();
        if (!guestRec) {
          const { error: insertError } = await sb.from('guests').insert({
            name: email.split('@')[0] || 'Guest',
            email: email,
            user_id: userId,
          });
          
          // Handle unique constraint violations gracefully
          if (insertError) {
            if (insertError.message?.includes('unique') || insertError.code === '23505') {
              // Email already exists as guest — this is fine, they're returning
              console.log('Guest record already exists for this email');
            } else {
              throw insertError;
            }
          }
        }
      }

      toast.success('Welcome to Keyman Hotel!');
      window.location.href = '/guest';
    } catch (err: any) {
      toast.error(err.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy via-navy/95 to-brass/20 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-bold text-white">
            Keyman<span className="text-brass"> Hotel</span>
          </h1>
          <p className="text-white/60 mt-2">Guest Portal</p>
        </div>

        <Card className="bg-white/95 backdrop-blur">
          <CardHeader className="text-center">
            <CardTitle className="font-display text-xl">
              {step === 'email' ? 'Welcome Guest' : 'Enter Code'}
            </CardTitle>
            <CardDescription>
              {step === 'email'
                ? 'Enter your email to sign in — no password needed'
                : `We sent a code to ${email}`
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 'email' ? (
              <>
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="guest@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      onKeyDown={(e) => e.key === 'Enter' && handleSendOTP()}
                    />
                  </div>
                </div>
                <Button variant="brass" className="w-full" onClick={handleSendOTP} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                  Send OTP Code
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>OTP Code</Label>
                  <Input
                    type="text"
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="text-center text-2xl tracking-[0.5em] font-mono"
                    maxLength={6}
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyOTP()}
                  />
                </div>
                <Button variant="brass" className="w-full" onClick={handleVerifyOTP} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                  Verify & Sign In
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setStep('email')}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Change Email
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-white/40 text-xs mt-6">
          By signing in you agree to our terms of service
        </p>
      </div>
    </div>
  );
}
