import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { AppRole } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const ROLE_FETCH_TIMEOUT_MS = 8000;

async function fetchUserRoleWithTimeout(userId: string): Promise<AppRole | null> {
  return new Promise(async (resolve) => {
    const timer = setTimeout(() => {
      console.warn('fetchUserRole timed out after', ROLE_FETCH_TIMEOUT_MS, 'ms');
      resolve(null);
    }, ROLE_FETCH_TIMEOUT_MS);

    try {
      const { data, error } = await sb
        .from('users')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      clearTimeout(timer);
      if (error) {
        console.error('fetchUserRole error:', error);
        resolve(null);
      } else {
        resolve((data?.role as AppRole) ?? null);
      }
    } catch (err) {
      clearTimeout(timer);
      console.error('fetchUserRole exception:', err);
      resolve(null);
    }
  });
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  // Check for impersonation
  const impersonateRaw = typeof window !== 'undefined' ? localStorage.getItem('impersonate') : null;
  const impersonateData = impersonateRaw ? JSON.parse(impersonateRaw) : null;
  const isImpersonating = !!impersonateData;
  const impersonatedRole = impersonateData?.targetUser?.role as AppRole | undefined;
  const impersonatedName = impersonateData?.targetUser?.full_name || impersonateData?.targetUser?.email;

  // If impersonating, use the impersonated role; otherwise use real role
  const effectiveRole = isImpersonating ? impersonatedRole : role;

  const isAdmin = isImpersonating ? impersonateData.targetUser?.role === 'admin' : role === 'admin';
  const isManager = isImpersonating
    ? ['admin', 'manager'].includes(impersonateData.targetUser?.role)
    : role === 'admin' || role === 'manager';
  const isStaff = isImpersonating ? !!impersonatedRole : (role !== null && role !== undefined);

  useEffect(() => {
    mountedRef.current = true;

    const handleSession = async (sessionUser: User | null) => {
      if (!mountedRef.current) return;

      setUser(sessionUser);

      if (sessionUser) {
        const r = await fetchUserRoleWithTimeout(sessionUser.id);
        if (mountedRef.current) setRole(r);
      } else {
        setRole(null);
      }

      if (mountedRef.current) setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        handleSession(session?.user ?? null);
      }
    );

    // Also check the current session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session?.user ?? null);
    });

    return () => {
      mountedRef.current = false;
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
    setUser(null);
    setRole(null);
  };

  // If impersonating, create a synthetic user object with the target user's info
  const displayUser = isImpersonating ? {
    ...user,
    id: impersonateData.targetUser?.id || user?.id,
    email: impersonateData.targetUser?.email || user?.email,
    user_metadata: {
      ...user?.user_metadata,
      full_name: impersonatedName,
    },
  } as User : user;

  return {
    user: displayUser,
    realUser: user, // Always the actual logged-in user
    role: effectiveRole,
    isAdmin,
    isManager,
    isStaff,
    loading,
    signIn,
    signUp,
    signOut,
    isImpersonating,
    impersonatedName,
  };
}
