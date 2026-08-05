import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../ui/Toast.jsx';
import { localizeRouteMetadata, resolveRouteMetadata } from '../../routeMetadata.js';
import { Sidebar } from './Sidebar.jsx';
import { Header } from './Header.jsx';
import { MobileNav } from './MobileNav.jsx';
import { HeaderControlsProvider } from './HeaderControls.jsx';

const SIDEBAR_STORAGE_KEY = 'tradinglog-sidebar-collapsed';

function readCollapsedState() {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function AppShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(readCollapsedState);
  const metadata = localizeRouteMetadata(resolveRouteMetadata(location.pathname), t);

  useEffect(() => {
    document.title = `${metadata.title} · TradingLog`;
  }, [metadata.title]);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // Persistence is optional; the control still works for this session.
      }
      return next;
    });
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
    toast.info(t('auth.loggedOut'));
  }

  return (
    <HeaderControlsProvider metadata={metadata}>
      <div className="flex h-dvh min-h-0 overflow-hidden bg-canvas-secondary text-primary">
        <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} user={user} onLogout={handleLogout} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-canvas">
          <Header metadata={metadata} />
          <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 adaptive:p-5 compact:p-6">
            {children}
          </main>
          <MobileNav />
        </div>
      </div>
    </HeaderControlsProvider>
  );
}
