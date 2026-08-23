import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Mail, KeyRound, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export default function GuestLogin() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async () => {
    if (!email) { toast.error('Enter your email'); return; }
    setLoading(true);
    try {
      const { error } = await sb.auth.signInWithOtp({ email });
      if (error) throw error;
      toast.success('OTP sent to your email');
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
      const { data, error } = await sb.auth.verifyOtp({ email, token: otp, type: 'email' });
      if (error) throw error;

      // Check if guest user exists, if not create one
      const { data: { user } } = await sb.auth.getUser();
      if (user) {
        const { data: existing } = await sb.from('users').select('id').eq('id', user.id).single();
        if (!existing) {
          await sb.from('users').insert({
            id: user.id,
            email: user.email,
            full_name: user.email?.split('@')[0] || 'Guest',
            role: 'guest',
            is_guest: true,
            is_active: true,
            otp_verified_at: new Date().toISOString(),
          });
        }
        // Also ensure a guest record exists for bookings
        const { data: guestRec } = await sb.from('guests').select('id').eq('user_id', user.id).single();
        if (!guestRec) {
          await sb.from('guests').insert({
            name: user.email?.split('@')[0] || 'Guest',
            email: user.email,
            user_id: user.id,
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
