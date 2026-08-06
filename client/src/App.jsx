import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ToastProvider } from './components/ui/Toast.jsx';
import { PreferencesProvider } from './context/PreferencesContext.jsx';
import { AppShell } from './components/layout/AppShell.jsx';
import { Spinner } from './components/ui/Spinner.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';

const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Trades = lazy(() => import('./pages/Trades.jsx'));
const TradeDetail = lazy(() => import('./pages/TradeDetail.jsx'));
const TradeEditor = lazy(() => import('./pages/TradeEditor.jsx'));
const Import = lazy(() => import('./pages/Import.jsx'));
const ImportRunDetail = lazy(() => import('./pages/ImportRunDetail.jsx'));
const Accounts = lazy(() => import('./pages/Accounts.jsx'));
const AccountDetail = lazy(() => import('./pages/AccountDetail.jsx'));
const Analytics = lazy(() => import('./pages/Analytics.jsx'));
const Journal = lazy(() => import('./pages/Journal.jsx'));
const Rules = lazy(() => import('./pages/Rules.jsx'));
const Goals = lazy(() => import('./pages/Goals.jsx'));
const DailyReview = lazy(() => import('./pages/DailyReview.jsx'));
const DailyReviewTodayRedirect = lazy(() => import('./pages/DailyReview.jsx').then((module) => ({
  default: module.DailyReviewTodayRedirect,
})));
const Strategies = lazy(() => import('./pages/Strategies.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const Portfolio = lazy(() => import('./pages/Portfolio.jsx'));
const PortfolioDetail = lazy(() => import('./pages/PortfolioDetail.jsx'));

function FullPageLoading() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas" role="status">
      <Spinner className="h-8 w-8" label={t('common.loading')} />
    </div>
  );
}

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Spinner className="h-8 w-8" label={t('common.loading')} />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <AppShell>{children}</AppShell>;
}

export function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoading />;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<FullPageLoading />}>
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
      <Route path="/import/history/:runId" element={<ProtectedRoute><ImportRunDetail /></ProtectedRoute>} />
      <Route path="/accounts"  element={<ProtectedRoute><Accounts /></ProtectedRoute>} />
      <Route path="/accounts/:accountId" element={<ProtectedRoute><AccountDetail /></ProtectedRoute>} />
      <Route path="/insights/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
      <Route path="/insights/journal" element={<ProtectedRoute><Journal /></ProtectedRoute>} />
      <Route path="/insights/rules" element={<ProtectedRoute><Rules /></ProtectedRoute>} />
      <Route path="/insights/goals" element={<ProtectedRoute><Goals /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/portfolio" element={<ProtectedRoute><Portfolio /></ProtectedRoute>} />
      <Route path="/portfolio/:portfolioId" element={<ProtectedRoute><PortfolioDetail /></ProtectedRoute>} />

      {/* Default redirect */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <ToastProvider>
          <PreferencesProvider>
            <AppRoutes />
          </PreferencesProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
