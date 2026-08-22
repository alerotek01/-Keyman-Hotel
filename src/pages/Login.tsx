import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { signIn, signUp, user, loading: authLoading } = useAuth();
  
  // Redirect to admin if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/admin');
    }
  }, [user, authLoading, navigate]);
  const { toast } = useToast();
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, fullName);
        if (error) throw error;
        toast({
          title: 'Account Created',
          description: 'Your account has been created successfully.',
        });
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
        toast({
          title: 'Welcome Back',
          description: 'You have been signed in successfully.',
        });
        navigate('/admin');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'An error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout hideFooter>
      <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-cream/40">
        <div className="w-full max-w-md space-y-8">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="flex items-baseline justify-center gap-1">
              <span className="font-display text-3xl text-charcoal">Keyman</span>
              <span className="text-[10px] font-medium tracking-[0.2em] uppercase text-brass">Hotel</span>
            </div>
            <div className="divider-brass mx-auto" />
            <p className="text-sm text-charcoal/50">
              {isSignUp 
                ? 'Create a new staff account'
                : 'Sign in to the staff portal'
              }
            </p>
          </div>

          {/* Form */}
          <div className="card-warm p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-xs font-medium tracking-wide uppercase text-charcoal/60">
                    Full Name
                  </Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Jane Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="rounded-full border-charcoal/10 focus-visible:ring-brass"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-medium tracking-wide uppercase text-charcoal/60">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@keymanhotel.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="rounded-full border-charcoal/10 focus-visible:ring-brass"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-medium tracking-wide uppercase text-charcoal/60">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="rounded-full border-charcoal/10 focus-visible:ring-brass"
                />
              </div>
              <Button type="submit" variant="brass" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isSignUp ? 'Creating...' : 'Signing in...'}
                  </>
                ) : (
                  isSignUp ? 'Create Account' : 'Sign In'
                )}
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <button 
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-xs text-charcoal/40 hover:text-charcoal transition-colors duration-300"
              >
                {isSignUp 
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Sign up"
                }
              </button>
            </div>
          </div>

          {/* Note */}
          <p className="text-center text-xs text-charcoal/30 leading-relaxed">
            After creating an account, admin access must be granted by an existing administrator.
          </p>
        </div>
      </div>
    </Layout>
  );
}
