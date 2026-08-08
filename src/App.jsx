import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import RoleGuard from '@/components/RoleGuard';
// Add page imports here
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Shell from '@/components/layout/Shell';
import Dashboard from '@/pages/Dashboard';
import Elections from '@/pages/Elections';
import ElectionWizard from '@/pages/ElectionWizard';
import Students from '@/pages/Students';
import Positions from '@/pages/Positions';
import Candidates from '@/pages/Candidates';
import Stations from '@/pages/Stations';
import Voting from '@/pages/Voting';
import Results from '@/pages/Results';
import Reports from '@/pages/Reports';
import Archives from '@/pages/Archives';
import Users from '@/pages/Users';
import Branding from '@/pages/Branding';
import Settings from '@/pages/Settings';
import AuditLogs from '@/pages/AuditLogs';
import StationSetup from '@/pages/StationSetup';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      {/* Public voting portal — voters never log in; the polling assistant's
          session (active on this PC) powers the API calls. */}
      <Route path="/vote" element={<Voting />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        {/* Polling assistant station selection (protected) */}
        <Route path="/station-setup" element={<StationSetup />} />
        {/* Admin + Observer shell — each route guarded by capability */}
        <Route element={<Shell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/elections" element={<RoleGuard cap="manage"><Elections /></RoleGuard>} />
          <Route path="/wizard" element={<RoleGuard cap="manage"><ElectionWizard /></RoleGuard>} />
          <Route path="/students" element={<RoleGuard cap="manage"><Students /></RoleGuard>} />
          <Route path="/positions" element={<RoleGuard cap="manage"><Positions /></RoleGuard>} />
          <Route path="/candidates" element={<RoleGuard cap="manage"><Candidates /></RoleGuard>} />
          <Route path="/stations" element={<RoleGuard cap="manage"><Stations /></RoleGuard>} />
          <Route path="/results" element={<RoleGuard cap="results"><Results /></RoleGuard>} />
          <Route path="/reports" element={<RoleGuard cap="reports"><Reports /></RoleGuard>} />
          <Route path="/archives" element={<RoleGuard cap="manage"><Archives /></RoleGuard>} />
          <Route path="/users" element={<RoleGuard cap="users"><Users /></RoleGuard>} />
          <Route path="/branding" element={<RoleGuard cap="manage"><Branding /></RoleGuard>} />
          <Route path="/settings" element={<RoleGuard cap="manage"><Settings /></RoleGuard>} />
          <Route path="/audit-logs" element={<RoleGuard cap="logs"><AuditLogs /></RoleGuard>} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App