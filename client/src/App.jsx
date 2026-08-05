import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ToastProvider } from './components/ui/Toast.jsx';
import { AppShell } from './components/layout/AppShell.jsx';
import { Spinner } from './components/ui/Spinner.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Trades from './pages/Trades.jsx';
import TradeDetail from './pages/TradeDetail.jsx';
import TradeEditor from './pages/TradeEditor.jsx';
import Import from './pages/Import.jsx';
import Accounts from './pages/Accounts.jsx';
import Analytics from './pages/Analytics.jsx';
import Journal from './pages/Journal.jsx';
import Rules from './pages/Rules.jsx';
import Goals from './pages/Goals.jsx';
import DailyReview, { DailyReviewTodayRedirect } from './pages/DailyReview.jsx';
import Strategies from './pages/Strategies.jsx';

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <AppShell>{children}</AppShell>;
}

export function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login"  element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />

      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/trades"    element={<ProtectedRoute><Trades /></ProtectedRoute>} />
      <Route path="/trades/new" element={<ProtectedRoute><TradeEditor /></ProtectedRoute>} />
      <Route path="/trades/:tradeId/edit" element={<ProtectedRoute><TradeEditor /></ProtectedRoute>} />
      <Route path="/trades/:id" element={<ProtectedRoute><TradeDetail /></ProtectedRoute>} />
      <Route path="/strategies" element={<ProtectedRoute><Strategies /></ProtectedRoute>} />
      <Route path="/daily-review" element={<ProtectedRoute><DailyReviewTodayRedirect /></ProtectedRoute>} />
      <Route path="/daily-review/:date" element={<ProtectedRoute><DailyReview /></ProtectedRoute>} />
      <Route path="/import"    element={<ProtectedRoute><Import /></ProtectedRoute>} />
      <Route path="/accounts"  element={<ProtectedRoute><Accounts /></ProtectedRoute>} />
      <Route path="/insights/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
      <Route path="/insights/journal" element={<ProtectedRoute><Journal /></ProtectedRoute>} />
      <Route path="/insights/rules" element={<ProtectedRoute><Rules /></ProtectedRoute>} />
      <Route path="/insights/goals" element={<ProtectedRoute><Goals /></ProtectedRoute>} />

      {/* Default redirect */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
