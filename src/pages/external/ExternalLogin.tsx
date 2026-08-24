import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Mail, KeyRound, ArrowLeft, Coffee } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { sendOTPVerification } from '@/lib/email';
import { toast } from 'sonner';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default function ExternalLogin() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async () => {
    if (!email) { toast.error('Enter your email'); return; }
    setLoading(true);
    try {
      // Check if email is staff (excluding admin/manager who can access external)
      const { data: staffUser } = await sb.from('users')
        .select('id, role')
        .eq('email', email)
        .in('role', ['receptionist', 'chef', 'waiter', 'housekeeper'])
        .single();
      
      if (staffUser) {
        toast.error('This email is registered as staff. Please use the staff dashboard instead.');
        setLoading(false);
        return;
      }

      const code = generateOTP();
      await sb.from('otp_codes').upsert({
        email: email,
        code: code,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      }, { onConflict: 'email' });

      const guestName = email.split('@')[0];
      const result = await sendOTPVerification(email, code, guestName);
      
      if (result.success) {
        toast.success('OTP sent to your email!');
      } else {
        toast.success(`OTP: ${code} (dev fallback)`);
      }
      setStep('otp');
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

      await sb.from('otp_codes').delete().eq('email', email);

      // Sign in with Supabase auth
      await sb.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });

      // Create/update external customer record
      const { data: { user: authUser } } = await sb.auth.getUser();
      if (authUser) {
        await sb.from('users').upsert({
          id: authUser.id,
          email: email,
          full_name: email.split('@')[0],
          role: 'external_customer',
          is_guest: true,
          is_active: true,
          otp_verified_at: new Date().toISOString(),
        }, { onConflict: 'id' });

        // Ensure guest record exists
        const { data: guestRec } = await sb.from('guests').select('id').eq('user_id', authUser.id).single();
        if (!guestRec) {
          await sb.from('guests').insert({
            name: email.split('@')[0],
            email: email,
            user_id: authUser.id,
          });
        }
      }

      toast.success('Welcome to Keyman Café!');
      window.location.href = '/external/order';
    } catch (err: any) {
      toast.error(err.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy via-navy/95 to-brass/20 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Coffee className="h-12 w-12 text-brass mx-auto mb-3" />
          <h1 className="font-display text-3xl font-bold text-white">
            Keyman<span className="text-brass"> Café</span>
          </h1>
          <p className="text-white/60 mt-2">Order food for pickup or delivery</p>
        </div>

        <Card className="bg-white/95 backdrop-blur">
          <CardHeader className="text-center">
            <CardTitle className="font-display text-xl">
              {step === 'email' ? 'Sign In to Order' : 'Enter Code'}
            </CardTitle>
            <CardDescription>
              {step === 'email'
                ? 'Enter your email — no password needed'
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
                      placeholder="your@email.com"
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
                  Verify & Start Ordering
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setStep('email')}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Change Email
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-white/40 text-xs mt-6">
          No account needed — just sign in with your email
        </p>
      </div>
    </div>
  );
}
