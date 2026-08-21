import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Rooms from "./pages/Rooms";
import Conference from "./pages/Conference";
import Cafeteria from "./pages/Cafeteria";
import CafeteriaMenu from "./pages/CafeteriaMenu";
import Login from "./pages/Login";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminRooms from "./pages/admin/Rooms";
import AdminBookings from "./pages/admin/Bookings";
import AdminAudit from "./pages/admin/Audit";
import AdminReports from "./pages/admin/Reports";
import AdminMenu from "./pages/admin/Menu";
import AdminSiteContent from "./pages/admin/SiteContent";
import ManagerLayout from "./pages/manager/ManagerLayout";
import ManagerDashboard from "./pages/manager/Dashboard";
import ManagerReports from "./pages/admin/Reports";
import ManagerBookings from "./pages/admin/Bookings";
import ManagerStaff from "./pages/manager/Staff";
import StaffLayout from "./pages/staff/StaffLayout";
import StaffDashboard from "./pages/staff/Dashboard";
import StaffBookings from "./pages/staff/Bookings";
import StaffRequests from "./pages/staff/GuestRequests";
import StaffReceipts from "./pages/staff/Receipts";
import HousekeeperPda from "./pages/staff/HousekeeperPda";
import HousekeepingSupervisor from "./pages/staff/HousekeepingSupervisor";
import ReceptionistPda from "./pages/staff/ReceptionistPda";
import WaiterPda from "./pages/staff/WaiterPda";
import KitchenTablet from "./pages/staff/KitchenTablet";
import PaymentRecording from "./pages/staff/PaymentRecording";
import ShiftManager from "./pages/staff/ShiftManager";
import Reconciliation from "./pages/manager/Reconciliation";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/rooms" element={<Rooms />} />
          <Route path="/conference" element={<Conference />} />
          <Route path="/cafeteria" element={<Cafeteria />} />
          <Route path="/cafeteria/:mealId" element={<CafeteriaMenu />} />
          <Route path="/login" element={<Login />} />
          
          {/* Admin Routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="rooms" element={<AdminRooms />} />
            <Route path="menu" element={<AdminMenu />} />
            <Route path="content" element={<AdminSiteContent />} />
            <Route path="bookings" element={<AdminBookings />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="audit" element={<AdminAudit />} />
          </Route>
          
          {/* Manager Routes */}
          <Route path="/manager" element={<ManagerLayout />}>
            <Route index element={<ManagerDashboard />} />
            <Route path="reports" element={<ManagerReports />} />
            <Route path="bookings" element={<ManagerBookings />} />
            <Route path="reconciliation" element={<Reconciliation />} />
            <Route path="staff" element={<ManagerStaff />} />
          </Route>
          
          {/* Staff Routes */}
          <Route path="/staff" element={<StaffLayout />}>
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
          </Route>
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
