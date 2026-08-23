import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import StaffLayout from '@/pages/staff/StaffLayout';
import StaffPdaLayout from '@/components/StaffPdaLayout';

const DESKTOP_BREAKPOINT = 768; // md breakpoint — below = mobile PDA, above = desktop sidebar

/**
 * Responsive layout wrapper:
 * - Viewport < 768px → Mobile PDA layout (bottom nav, touch-friendly)
 * - Viewport >= 768px → Desktop sidebar layout (full navigation)
 * 
 * Automatically switches as the browser window is resized.
 */
export default function RoleAwareLayout() {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return true; // SSR default
    return window.innerWidth >= DESKTOP_BREAKPOINT;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    
    // Set initial value
    setIsDesktop(mediaQuery.matches);

    // Listen for changes
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mediaQuery.addEventListener('change', handler);

    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Desktop: full sidebar layout
  if (isDesktop) {
    return <StaffLayout />;
  }

  // Mobile: PDA layout with bottom nav
  return <StaffPdaLayout />;
}
