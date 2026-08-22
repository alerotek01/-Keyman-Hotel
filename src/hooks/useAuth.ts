import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { AppRole } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = role === 'admin';
  const isManager = role === 'admin' || role === 'manager';
  const isStaff = role !== null && role !== undefined;

  useEffect(() => {
    const fetchUserRole = async (userId: string) => {
      const { data } = await sb
        .from('users')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (data) {
        setRole(data.role as AppRole);
      } else {
        setRole(null);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);

        if (session?.user) {
          try {
            await fetchUserRole(session.user.id);
          } catch (err) {
            console.error('Auth state change - role fetch failed:', err);
            setRole(null);
          }
        } else {
          setRole(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);

      if (session?.user) {
        try {
          await fetchUserRole(session.user.id);
        } catch (err) {
          console.error('Failed to fetch user role:', err);
          setRole(null);
        }
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return {
    user,
    role,
    isAdmin,
    isManager,
    isStaff,
    loading,
    signIn,
    signUp,
    signOut,
  };
}
