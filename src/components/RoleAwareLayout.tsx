import { useAuth } from '@/hooks/useAuth';
import StaffLayout from '@/pages/staff/StaffLayout';
import StaffPdaLayout from '@/components/StaffPdaLayout';

/**
 * Role-aware layout wrapper:
 * - Waiter & Chef → Desktop sidebar layout (StaffLayout)
 * - All other staff → Mobile PDA layout (StaffPdaLayout)
 */
export default function RoleAwareLayout() {
  const { role } = useAuth();

  // Waiter and chef get the full desktop dashboard
  if (role === 'waiter' || role === 'chef') {
    return <StaffLayout />;
  }

  // Everyone else gets the mobile PDA
  return <StaffPdaLayout />;
}
