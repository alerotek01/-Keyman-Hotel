import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut, Menu, X } from 'lucide-react';

export function Header() {
  const location = useLocation();
  const { user, isAdmin, isManager, isStaff, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  
  const isActive = (path: string) => location.pathname === path;

  const getDashboardLink = () => {
    if (isAdmin) return '/admin';
    if (isManager) return '/manager';
    if (isStaff) return '/staff';
    return '/login';
  };

  const getDashboardLabel = () => {
    if (isAdmin) return 'Dashboard';
    if (isManager) return 'Dashboard';
    if (isStaff) return 'Dashboard';
    return 'Staff Login';
  };

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/rooms', label: 'Rooms' },
    { to: '/conference', label: 'Conference' },
    { to: '/cafeteria', label: 'Cafeteria' },
  ];

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 px-4 pt-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between rounded-full bg-white/80 backdrop-blur-xl border border-black/[0.04] px-4 sm:px-6 py-3 shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
          <Link to="/" className="flex items-baseline gap-1">
            <span className="font-display text-lg sm:text-xl text-charcoal">
              Keyman
            </span>
            <span className="text-[9px] sm:text-[10px] font-medium tracking-[0.2em] uppercase text-brass">
              Hotel
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-8">
            {navLinks.map((link) => (
              <Link 
                key={link.to}
                to={link.to} 
                className={cn(
                  "text-sm font-medium transition-colors duration-300",
                  isActive(link.to) ? "text-charcoal" : "text-charcoal/50 hover:text-charcoal"
                )}
              >
                {link.label}
              </Link>
            ))}
            {(isAdmin || isManager || isStaff) && (
              <Link 
                to={getDashboardLink()} 
                className={cn(
                  "text-sm font-medium transition-colors duration-300",
                  location.pathname.startsWith(getDashboardLink()) ? "text-charcoal" : "text-charcoal/50 hover:text-charcoal"
                )}
              >
                {getDashboardLabel()}
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="hidden sm:flex items-center gap-3">
                <span className="text-xs text-charcoal/40 font-mono">
                  {user.email?.split('@')[0]}
                </span>
                <Button variant="ghost" size="sm" onClick={signOut} className="text-charcoal/50 hover:text-charcoal">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Link to="/login" className="hidden sm:block">
                <Button variant="brass" size="sm">
                  Staff Login
                </Button>
              </Link>
            )}
            
            {/* Mobile hamburger */}
            <button 
              className="md:hidden p-2 text-charcoal/60 hover:text-charcoal"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-charcoal/20 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute top-20 left-4 right-4 bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] border border-black/[0.04] p-6 space-y-1">
            {navLinks.map((link) => (
              <Link 
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "block py-3 px-4 rounded-xl text-sm font-medium transition-colors",
                  isActive(link.to) 
                    ? "bg-brass/10 text-brass" 
                    : "text-charcoal/60 hover:bg-charcoal/[0.03]"
                )}
              >
                {link.label}
              </Link>
            ))}
            {(isAdmin || isManager || isStaff) && (
              <Link 
                to={getDashboardLink()}
                onClick={() => setMobileOpen(false)}
                className="block py-3 px-4 rounded-xl text-sm font-medium text-charcoal/60 hover:bg-charcoal/[0.03]"
              >
                {getDashboardLabel()}
              </Link>
            )}
            <div className="border-t border-charcoal/[0.06] mt-3 pt-3">
              {user ? (
                <div className="flex items-center justify-between px-4">
                  <span className="text-xs text-charcoal/40 font-mono">{user.email?.split('@')[0]}</span>
                  <Button variant="ghost" size="sm" onClick={() => { signOut(); setMobileOpen(false); }} className="text-charcoal/50">
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Link to="/login" onClick={() => setMobileOpen(false)}>
                  <Button variant="brass" size="sm" className="w-full">
                    Staff Login
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
