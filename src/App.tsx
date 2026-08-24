import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ResponsiveLayout from "./components/ResponsiveLayout";
import Index from "./pages/Index";
import Rooms from "./pages/Rooms";
import Conference from "./pages/Conference";
import Cafeteria from "./pages/Cafeteria";
import CafeteriaMenu from "./pages/CafeteriaMenu";
import Login from "./pages/Login";
import GuestLogin from "./pages/guest/GuestLogin";
import GuestDashboard from "./pages/guest/GuestDashboard";
import GuestFolio from "./pages/guest/GuestFolio";
import GuestOrder from "./pages/guest/GuestOrder";
import GuestChat from "./pages/guest/GuestChat";
import BookingFlow from "./pages/guest/BookingFlow";
import ConferenceBooking from "./pages/guest/ConferenceBooking";
import ExternalOrder from "./pages/guest/ExternalOrder";
import ExternalLogin from "./pages/external/ExternalLogin";
import ExternalDashboard from "./pages/external/ExternalDashboard";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminRooms from "./pages/admin/Rooms";
import AdminBookings from "./pages/admin/Bookings";
import AdminAudit from "./pages/admin/Audit";
import AdminOperations from "./pages/admin/Operations";
import MessagePage from "./pages/MessagePage";
import NotificationSettings from "./pages/NotificationSettings";
import AdminReports from "./pages/admin/Reports";
import AdminMenu from "./pages/admin/Menu";
import AdminSiteContent from "./pages/admin/SiteContent";
import AdminFolios from "./pages/admin/FolioManagement";
import AdminBookingSettings from "./pages/admin/BookingSettings";
import PaymentVerification from "./pages/admin/PaymentVerification";
import ConferenceManagement from "./pages/admin/ConferenceManagement";
import AdminUsers from "./pages/admin/Users";
import ManagerDashboard from "./pages/manager/Dashboard";
import ManagerReports from "./pages/admin/Reports";
import ManagerBookings from "./pages/admin/Bookings";
import ManagerStaff from "./pages/manager/Staff";
import ShiftManagement from "./pages/manager/ShiftManagement";
import InventoryComingSoon from "./pages/manager/InventoryComingSoon";
import ManagerOperations from "./pages/manager/ManagerOperations";
import StaffDashboard from "./pages/staff/Dashboard";
import StaffBookings from "./pages/staff/Bookings";
import StaffRequests from "./pages/staff/GuestRequests";
import StaffReceipts from "./pages/staff/Receipts";
import ReceptionistPda from "./pages/staff/ReceptionistPda";
import WaiterPda from "./pages/staff/WaiterPda";
import KitchenTablet from "./pages/staff/KitchenTablet";
import PaymentRecording from "./pages/staff/PaymentRecording";
import ShiftManager from "./pages/staff/ShiftManager";
import HousekeeperPda from "./pages/staff/HousekeeperPda";
import HousekeepingSupervisor from "./pages/staff/HousekeepingSupervisor";
import Reconciliation from "./pages/manager/Reconciliation";
import ReconciliationAnalytics from "./pages/manager/ReconciliationAnalytics";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Index />} />
          <Route path="/rooms" element={<Rooms />} />
          <Route path="/conference" element={<Conference />} />
          <Route path="/cafeteria" element={<Cafeteria />} />
          <Route path="/cafeteria/:mealId" element={<CafeteriaMenu />} />
          <Route path="/login" element={<Login />} />

          {/* Guest Routes (Responsive — mobile PDA ↔ desktop sidebar) */}
          <Route path="/guest/login" element={<GuestLogin />} />
          <Route path="/guest" element={<ResponsiveLayout basePath="/guest" />}>
            <Route index element={<GuestDashboard />} />
            <Route path="folio" element={<GuestFolio />} />
            <Route path="order" element={<GuestOrder />} />
            <Route path="chat" element={<GuestChat />} />
            <Route path="booking" element={<BookingFlow />} />
            <Route path="conference" element={<ConferenceBooking />} />
          </Route>

          {/* External Customer Routes */}
          <Route path="/external/login" element={<ExternalLogin />} />
          <Route path="/external" element={<ResponsiveLayout basePath="/external" allowedRoles={["external_customer", "guest", "admin", "manager"]} />}>
            <Route index element={<ExternalDashboard />} />
            <Route path="order" element={<ExternalOrder />} />
          </Route>

          {/* Admin Routes (Responsive) */}
          <Route path="/admin" element={<ResponsiveLayout basePath="/admin" />}>
            <Route index element={<AdminDashboard />} />
            <Route path="rooms" element={<AdminRooms />} />
            <Route path="menu" element={<AdminMenu />} />
            <Route path="content" element={<AdminSiteContent />} />
            <Route path="bookings" element={<AdminBookings />} />
            <Route path="folios" element={<AdminFolios />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="audit" element={<AdminAudit />} />
            <Route path="operations" element={<AdminOperations />} />
            <Route path="booking-settings" element={<AdminBookingSettings />} />
            <Route path="payments-verify" element={<PaymentVerification />} />
            <Route path="conference" element={<ConferenceManagement />} />
            <Route path="messages" element={<MessagePage />} />
            <Route path="notification-settings" element={<NotificationSettings />} />
          </Route>

          {/* Manager Routes (Responsive) */}
          <Route path="/manager" element={<ResponsiveLayout basePath="/manager" />}>
            <Route index element={<ManagerDashboard />} />
            <Route path="reports" element={<ManagerReports />} />
            <Route path="bookings" element={<ManagerBookings />} />
            <Route path="reconciliation" element={<Reconciliation />} />
            <Route path="reconciliation/analytics" element={<ReconciliationAnalytics />} />
            <Route path="staff" element={<ManagerStaff />} />
            <Route path="shift" element={<ShiftManagement />} />
            <Route path="inventory" element={<InventoryComingSoon />} />
            <Route path="operations" element={<ManagerOperations />} />
            <Route path="messages" element={<MessagePage />} />
            <Route path="notification-settings" element={<NotificationSettings />} />
          </Route>

          {/* Staff Routes (Responsive) */}
          <Route path="/staff" element={<ResponsiveLayout basePath="/staff" />}>
            <Route index element={<StaffDashboard />} />
            <Route path="bookings" element={<StaffBookings />} />
            <Route path="reception" element={<ReceptionistPda />} />
            <Route path="waiter" element={<WaiterPda />} />
            <Route path="kitchen" element={<KitchenTablet />} />
            <Route path="payments" element={<PaymentRecording />} />
            <Route path="shift" element={<ShiftManager />} />
            <Route path="housekeeping" element={<HousekeeperPda />} />
            <Route path="inspection" element={<HousekeepingSupervisor />} />
            <Route path="requests" element={<StaffRequests />} />
            <Route path="receipts" element={<StaffReceipts />} />
            <Route path="messages" element={<MessagePage />} />
            <Route path="notification-settings" element={<NotificationSettings />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
