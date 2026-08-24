import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
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

  const [email, setEmail] = useState<string | null>(null);
  const [isRecovery, setIsRecovery] = useState(false);
  const [recoveryAccessToken, setRecoveryAccessToken] = useState<string | null>(null);
  const [recoveryRefreshToken, setRecoveryRefreshToken] = useState<string | null>(null);

  const [inviteToken, setInviteToken] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [alreadyVerified, setAlreadyVerified] = useState(false);
  const [success, setSuccess] = useState(false);

  // Parse URL on mount
  useEffect(() => {
    // 1. Check hash fragment — Supabase recovery link format:
    //    /set-password#access_token=xxx&refresh_token=yyy&type=recovery&token_type=bearer
    const hash = window.location.hash;
    if (hash && hash.length > 1) {
      const params = new URLSearchParams(hash.substring(1));
      const at = params.get('access_token');
      const rt = params.get('refresh_token');
      const type = params.get('type');

      if (at && type === 'recovery') {
        setRecoveryAccessToken(at);
        setRecoveryRefreshToken(rt || '');
        setIsRecovery(true);

        // Exchange tokens for a session so we can get the user's email
        const establishSession = async () => {
          try {
            const { data, error } = await sb.auth.setSession({
              access_token: at,
              refresh_token: rt || '',
            });
            if (error) {
              console.error('setSession error:', error);
              setTokenValid(false);
              setVerifying(false);
              return;
            }

            // Get email from the session user
            if (data?.user?.email) {
              setEmail(data.user.email);
            }
            setTokenValid(true);
            setVerifying(false);
          } catch (err) {
            console.error('Session establishment failed:', err);
            setTokenValid(false);
            setVerifying(false);
          }
        };
        establishSession();
        return;
      }
    }

    // 2. Check query params — Staff invite link:
    //    /set-password?token=xxx&email=yyy
    const token = searchParams.get('token');
    const em = searchParams.get('email');

    if (token && em) {
      setInviteToken(token);
      setEmail(em);

      const verifyToken = async () => {
        try {
          const { data } = await sb.rpc('verify_set_password_token', {
            p_email: em,
            p_token: token,
          });
          if (data?.already_verified) {
            setAlreadyVerified(true);
          }
          setTokenValid(data?.success || false);
        } catch {
          setTokenValid(false);
        }
        setVerifying(false);
      };
      verifyToken();
      return;
    }

    // 3. No valid params found
    setVerifying(false);
  }, [searchParams]);

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
      if (isRecovery) {
        // Supabase recovery flow — session is already established via setSession
        const { error } = await sb.auth.updateUser({ password });
        if (error) throw error;

        toast.success('Password reset successfully!');
        setSuccess(true);
        setTimeout(async () => {
          try {
            const { data: userData } = await sb.auth.getUser();
            const uid = userData?.user?.id;
            if (uid) {
              const { data: roleData } = await sb.rpc('get_user_role', { p_user_id: uid });
              const role = roleData || 'staff';
              if (role === 'admin') window.location.href = '/admin';
              else if (role === 'manager') window.location.href = '/manager';
              else if (role === 'guest') window.location.href = '/guest';
              else window.location.href = '/staff';
            } else {
              window.location.href = '/staff';
            }
          } catch {
            window.location.href = '/staff';
          }
        }, 1500);
      } else if (inviteToken && email) {
        // Staff invite flow — use server-side function
        const { data: result, error } = await sb.rpc('set_user_password', {
          p_email: email,
          p_new_password: password,
        });
        if (error) throw error;
        if (!result?.success) throw new Error(result?.error || 'Failed to set password');

        // Sign in with the new password
        const { error: signInError } = await sb.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          // Password was set, just can't auto-login — redirect to login
          toast.success('Password set! Please sign in.');
          setSuccess(true);
          setTimeout(() => { window.location.href = '/login'; }, 1500);
          return;
        }

        toast.success('Password set successfully!');
        setSuccess(true);
        setTimeout(() => {
          window.location.href = '/staff';
        }, 1500);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to set password');
    }
    setLoading(false);
  };

  // Missing parameters
  if (!verifying && !tokenValid && !isRecovery && !inviteToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy via-navy/95 to-brass/20 flex items-center justify-center p-4">
        <Card className="bg-white/95 backdrop-blur w-full max-w-md">
          <CardContent className="py-12 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="font-display text-xl font-bold">Invalid Link</h2>
            <p className="text-muted-foreground text-sm">This password reset link is invalid or has expired.</p>
            <a href="/login"><Button variant="outline" className="mt-2">Go to Login</Button></a>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Verifying
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

  // Already verified
  if (alreadyVerified && !success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy via-navy/95 to-brass/20 flex items-center justify-center p-4">
        <Card className="bg-white/95 backdrop-blur w-full max-w-md">
          <CardContent className="py-12 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <h2 className="font-display text-xl font-bold">Password Already Set</h2>
            <p className="text-muted-foreground text-sm">You can log in directly.</p>
            <a href="/login"><Button variant="brass" className="mt-4">Go to Login</Button></a>
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
            <p className="text-muted-foreground text-sm">Redirecting to your dashboard...</p>
            <Loader2 className="h-4 w-4 animate-spin text-brass mx-auto" />
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
          <p className="text-white/60 mt-2">
            {isRecovery ? 'Reset Your Password' : 'Set Your Password'}
          </p>
        </div>

        <Card className="bg-white/95 backdrop-blur">
          <CardContent className="py-8 px-8">
            <form onSubmit={handleSetPassword} className="space-y-4">
              {email && (
                <p className="text-sm text-muted-foreground text-center">{email}</p>
              )}
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
                {isRecovery ? 'Reset Password' : 'Set Password & Continue'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
