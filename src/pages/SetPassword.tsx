import { useState, useEffect } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export default function SetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const type = searchParams.get('type'); // 'signup' or 'magiclink' or 'recovery'
  const email = searchParams.get('email');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);

  // Verify the token on mount
  useEffect(() => {
    if (!token || !type || !email) {
      setVerifying(false);
      setError('Invalid or missing link parameters');
      return;
    }

    const verifyToken = async () => {
      try {
        // Verify the recovery/signup link via Supabase
        const { error: verifyError } = await sb.auth.verifyOtp({
          email,
          token,
          type: type as any,
        });

        if (verifyError) {
          setError('This link has expired or is invalid. Please request a new one.');
        } else {
          setTokenValid(true);
        }
      } catch {
        setError('Failed to verify link. Please try again.');
      }
      setVerifying(false);
    };

    verifyToken();
  }, [token, type, email]);

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
      // Update password via Supabase
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;

      setSuccess(true);
      toast.success('Password set successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to set password');
    }
    setLoading(false);
  };

  // Missing parameters
  if (!token || !type || !email) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy via-navy/95 to-brass/20 flex items-center justify-center p-4">
        <Card className="bg-white/95 backdrop-blur w-full max-w-md">
          <CardContent className="py-12 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="font-display text-xl font-bold">Invalid Link</h2>
            <p className="text-muted-foreground text-sm">This password setup link is invalid or missing required parameters.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Verifying token
  if (verifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy via-navy/95 to-brass/20 flex items-center justify-center p-4">
        <Card className="bg-white/95 backdrop-blur w-full max-w-md">
          <CardContent className="py-12 text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-brass mx-auto" />
            <p className="text-muted-foreground">Verifying your link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Token invalid
  if (!tokenValid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy via-navy/95 to-brass/20 flex items-center justify-center p-4">
        <Card className="bg-white/95 backdrop-blur w-full max-w-md">
          <CardContent className="py-12 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="font-display text-xl font-bold">Link Expired</h2>
            <p className="text-muted-foreground text-sm">{error || 'This link has expired or is invalid.'}</p>
            <p className="text-muted-foreground text-xs">Contact your administrator to get a new invitation link.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy via-navy/95 to-brass/20 flex items-center justify-center p-4">
        <Card className="bg-white/95 backdrop-blur w-full max-w-md">
          <CardContent className="py-12 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <h2 className="font-display text-xl font-bold">Password Set!</h2>
            <p className="text-muted-foreground text-sm">Your password has been set. You can now log in.</p>
            <a href="/login">
              <Button variant="brass" className="mt-4">Go to Login</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Set password form
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
          <CardHeader className="text-center">
            <CardTitle className="font-display text-xl">Welcome aboard! 👋</CardTitle>
            <CardDescription>
              Set your password to access the {type === 'signup' ? 'system' : 'dashboard'}.
              <br />
              <span className="text-xs text-muted-foreground">{email}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSetPassword} className="space-y-4">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
