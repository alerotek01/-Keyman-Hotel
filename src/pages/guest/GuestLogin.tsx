import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Mail, KeyRound, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { sendOTPVerification } from '@/lib/email';
import { toast } from 'sonner';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default function GuestLogin() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState('');

  const handleSendOTP = async () => {
    if (!email) { toast.error('Enter your email'); return; }
    setLoading(true);
    try {
      // Generate OTP and store it
      const code = generateOTP();
      setGeneratedOtp(code);

      // Store OTP in DB for verification
      await sb.from('otp_codes').upsert({
        email: email,
        code: code,
        expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour
      }, { onConflict: 'email' });

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
      // Verify against stored OTP
      const { data: otpRecord } = await sb.from('otp_codes')
        .select('*')
        .eq('email', email)
        .eq('code', otp)
        .gte('expires_at', new Date().toISOString())
        .single();

      if (!otpRecord) {
        toast.error('Invalid or expired OTP code');
        setLoading(false);
        return;
      }

      // Delete used OTP
      await sb.from('otp_codes').delete().eq('email', email);

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
          await sb.from('guests').insert({
            name: email.split('@')[0] || 'Guest',
            email: email,
            user_id: userId,
          });
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
