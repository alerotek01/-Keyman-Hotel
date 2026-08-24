import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, KeyRound, CheckCircle2, AlertCircle, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

/**
 * Handles three URL patterns:
 * 1. PKCE code exchange:  /set-password?code=xxx&type=recovery
 * 2. Hash fragment:       /set-password#access_token=xxx&refresh_token=yyy&type=recovery
 * 3. Staff invite:        /set-password?token=xxx&email=yyy
 * 4. Supabase errors:     /set-password?error=access_denied&error_code=otp_expired
 */
export default function SetPassword() {
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState<string | null>(null);
  const [isRecovery, setIsRecovery] = useState(false);

  const [inviteToken, setInviteToken] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [alreadyVerified, setAlreadyVerified] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sign out helper — always sign out when landing on this page
  // This prevents the dangerous auto-login the user reported
  const signOutAndRedirect = async () => {
    try { await sb.auth.signOut(); } catch { /* ignore */ }
    window.location.href = '/login';
  };

  // Parse URL on mount
  useEffect(() => {
    const init = async () => {
      // 0. Check for Supabase error params (otp_expired, access_denied, etc.)
      const errCode = searchParams.get('error_code');
      const errDesc = searchParams.get('error_description');
      if (errCode) {
        let friendly = 'This password reset link is invalid or has expired.';
        if (errCode === 'otp_expired') {
          friendly = 'This password reset link has expired. Please request a new one.';
        } else if (errCode === 'otp_disabled') {
          friendly = 'Password reset is temporarily disabled. Please try again later.';
        } else if (errDesc) {
          friendly = decodeURIComponent(errDesc.replace(/\+/g, ' '));
        }
        setErrorMsg(friendly);
        setVerifying(false);
        return;
      }

      // 1. PKCE code exchange — Supabase redirects with ?code=xxx&type=recovery
      const code = searchParams.get('code');
      const type = searchParams.get('type');

      if (code && (type === 'recovery' || type === 'magiclink')) {
        setIsRecovery(true);
        try {
          const { data, error } = await sb.auth.exchangeCodeForSession(code);
          if (error) {
            console.error('exchangeCodeForSession error:', error);
            setErrorMsg('This link is invalid or has expired. Please request a new one.');
            setVerifying(false);
            return;
          }

          if (data?.user?.email) {
            setEmail(data.user.email);
          }
          setTokenValid(true);
          setVerifying(false);
        } catch (err) {
          console.error('PKCE exchange failed:', err);
          setErrorMsg('Failed to verify link. Please try again.');
          setVerifying(false);
        }
        return;
      }

      // 2. Hash fragment — implicit flow: #access_token=xxx&refresh_token=yyy&type=recovery
      const hash = window.location.hash;
      if (hash && hash.length > 1) {
        const hashParams = new URLSearchParams(hash.substring(1));
        const at = hashParams.get('access_token');
        const rt = hashParams.get('refresh_token');
        const hashType = hashParams.get('type');

        if (at && hashType === 'recovery') {
          setIsRecovery(true);
          try {
            const { data, error } = await sb.auth.setSession({
              access_token: at,
              refresh_token: rt || '',
            });
            if (error) {
              setErrorMsg('Failed to verify link. Please request a new one.');
              setVerifying(false);
              return;
            }
            if (data?.user?.email) {
              setEmail(data.user.email);
            }
            setTokenValid(true);
            setVerifying(false);
          } catch (err) {
            setErrorMsg('Failed to verify link. Please try again.');
            setVerifying(false);
          }
          return;
        }
      }

      // 3. Staff invite link: ?token=xxx&email=yyy
      const token = searchParams.get('token');
      const em = searchParams.get('email');

      if (token && em) {
        setInviteToken(token);
        setEmail(em);

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
        return;
      }

      // 4. No valid params found
      setVerifying(false);
    };

    init();
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
        // Session already established via PKCE exchange or setSession
        const { error } = await sb.auth.updateUser({ password });
        if (error) throw error;

        toast.success('Password reset successfully!');
        setSuccess(true);

        // Sign out then sign back in to get a clean session
        await sb.auth.signOut();
        const { data: signInData, error: signInError } = await sb.auth.signInWithPassword({
          email: email || '',
          password,
        });
        if (signInError) {
          // Password set, redirect to login
          setTimeout(() => { window.location.href = '/login'; }, 1500);
          return;
        }

        // Route to correct dashboard
        const uid = signInData?.user?.id;
        if (uid) {
          const { data: roleData } = await sb.rpc('get_user_role', { p_user_id: uid });
          const role = roleData || 'staff';
          setTimeout(() => {
            if (role === 'admin') window.location.href = '/admin';
            else if (role === 'manager') window.location.href = '/manager';
            else if (role === 'guest') window.location.href = '/guest';
            else window.location.href = '/staff';
          }, 1500);
        } else {
          setTimeout(() => { window.location.href = '/staff'; }, 1500);
        }
      } else if (inviteToken && email) {
        // Staff invite flow
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
          toast.success('Password set! Please sign in.');
          setSuccess(true);
          setTimeout(() => { window.location.href = '/login'; }, 1500);
          return;
        }

        toast.success('Password set successfully!');
        setSuccess(true);
        setTimeout(() => { window.location.href = '/staff'; }, 1500);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to set password');
    }
    setLoading(false);
  };

  // Error state (expired link, invalid code, etc.)
  if (!verifying && errorMsg) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy via-navy/95 to-brass/20 flex items-center justify-center p-4">
        <Card className="bg-white/95 backdrop-blur w-full max-w-md">
          <CardContent className="py-12 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="font-display text-xl font-bold">Invalid Link</h2>
            <p className="text-muted-foreground text-sm">{errorMsg}</p>
            <div className="flex flex-col gap-2 mt-4">
              <Button variant="brass" onClick={signOutAndRedirect}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out & Go to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Missing parameters
  if (!verifying && !tokenValid && !isRecovery && !inviteToken && !errorMsg) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy via-navy/95 to-brass/20 flex items-center justify-center p-4">
        <Card className="bg-white/95 backdrop-blur w-full max-w-md">
          <CardContent className="py-12 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="font-display text-xl font-bold">Invalid Link</h2>
            <p className="text-muted-foreground text-sm">This password reset link is invalid or has expired.</p>
            <div className="flex flex-col gap-2 mt-4">
              <Button variant="brass" onClick={signOutAndRedirect}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out & Go to Login
              </Button>
            </div>
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
            <Button variant="brass" className="mt-4" onClick={signOutAndRedirect}>
              Go to Login
            </Button>
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
