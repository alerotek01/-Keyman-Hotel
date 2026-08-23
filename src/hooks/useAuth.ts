import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logImpersonationEnd } from '@/lib/audit';
import type { User } from '@supabase/supabase-js';
import type { AppRole } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const ROLE_FETCH_TIMEOUT_MS = 8000;

interface UserProfile {
  full_name: string | null;
  role: AppRole | null;
  email: string | null;
}

async function fetchUserProfile(userId: string): Promise<UserProfile> {
  return new Promise(async (resolve) => {
    const timer = setTimeout(() => {
      resolve({ full_name: null, role: null, email: null });
    }, ROLE_FETCH_TIMEOUT_MS);

    try {
      const { data, error } = await sb
        .from('users')
        .select('full_name, role, email')
        .eq('id', userId)
        .maybeSingle();

      clearTimeout(timer);
      if (error || !data) {
        resolve({ full_name: null, role: null, email: null });
      } else {
        resolve({
          full_name: data.full_name || null,
          role: (data.role as AppRole) || null,
          email: data.email || null,
        });
      }
    } catch (err) {
      clearTimeout(timer);
      resolve({ full_name: null, role: null, email: null });
    }
  });
}

// Role label mapping for display
const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  receptionist: 'Receptionist',
  chef: 'Chef',
  waiter: 'Waiter',
  housekeeper: 'Housekeeper',
  accountant: 'Accountant',
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  // Check for impersonation
  const impersonateRaw = typeof window !== 'undefined' ? localStorage.getItem('impersonate') : null;
  const impersonateData = impersonateRaw ? JSON.parse(impersonateRaw) : null;
  const isImpersonating = !!impersonateData;
  const impersonatedRole = impersonateData?.targetUser?.role as AppRole | undefined;
  const impersonatedName = impersonateData?.targetUser?.full_name || impersonateData?.targetUser?.email;
  const impersonatedEmail = impersonateData?.targetUser?.email as string | undefined;

  // If impersonating, use the impersonated role; otherwise use real role
  const effectiveRole = isImpersonating ? impersonatedRole : role;

  const isAdmin = isImpersonating ? impersonateData.targetUser?.role === 'admin' : role === 'admin';
  const isManager = isImpersonating
    ? ['admin', 'manager'].includes(impersonateData.targetUser?.role)
    : role === 'admin' || role === 'manager';
  const isStaff = isImpersonating ? !!impersonatedRole : (role !== null && role !== undefined);

  // Display identity — show impersonated user if impersonating, otherwise real user
  const displayName = isImpersonating
    ? (impersonatedName || impersonatedEmail || 'Unknown')
    : (fullName || user?.email?.split('@')[0] || 'User');
  const displayRole = isImpersonating
    ? (ROLE_LABELS[impersonatedRole || ''] || impersonatedRole || 'Staff')
    : (ROLE_LABELS[role || ''] || role || 'Staff');
  const displayEmail = isImpersonating
    ? (impersonatedEmail || user?.email)
    : user?.email;

  useEffect(() => {
    mountedRef.current = true;

    const handleSession = async (sessionUser: User | null) => {
      if (!mountedRef.current) return;

      setUser(sessionUser);

      if (sessionUser) {
        const profile = await fetchUserProfile(sessionUser.id);
        if (mountedRef.current) {
          setRole(profile.role);
          setFullName(profile.full_name);
        }
      } else {
        setRole(null);
        setFullName(null);
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
    // Clear impersonation before signing out
    localStorage.removeItem('impersonate');
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    setFullName(null);
    // Force redirect to login
    window.location.href = '/login';
  };

  const stopImpersonating = () => {
    // Log impersonation end to audit_logs
    if (impersonateData) {
      const adminId = impersonateData.adminId || user?.id || '';
      const adminEmail = user?.email || '';
      logImpersonationEnd({
        adminId,
        adminEmail,
        auditLogId: impersonateData.auditLogId || '',
        targetUserId: impersonateData.targetUser?.id || '',
        targetName: impersonateData.targetUser?.full_name || impersonateData.targetUser?.email || '',
        targetRole: impersonateData.targetUser?.role || '',
        startedAt: impersonateData.startedAt || new Date().toISOString(),
      }).catch(() => {}); // fire-and-forget
    }
    localStorage.removeItem('impersonate');
    window.location.reload();
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
    displayName,
    displayRole,
    displayEmail,
    isAdmin,
    isManager,
    isStaff,
    loading,
    signIn,
    signUp,
    signOut,
    stopImpersonating,
    isImpersonating,
    impersonatedName,
  };
}
