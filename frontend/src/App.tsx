import { Spin } from 'antd';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';

import DoraWidget from './components/DoraWidget';
import { useAuth } from './contexts/AuthContext';
import { ScrollRestorationProvider } from './contexts/ScrollRestorationContext';
import TeamLayout from './layouts/TeamLayout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import PegawaiTasks from './pages/PegawaiTasks';
import ProjectDetail from './pages/ProjectDetail';
import Projects from './pages/Projects';
import Settings from './pages/Settings';
import TeamBoard from './pages/TeamBoard';
import TeamDivisionMembers from './pages/TeamDivisionMembers';
import Teams from './pages/Teams';

function PrivateRoute({ children }) {
  const { isLoggedIn, loading } = useAuth()
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen h-screen "><Spin size="large" /></div>
  }
  return isLoggedIn ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { isLoggedIn, loading } = useAuth()
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen h-screen"><Spin size="large" /></div>
  }
  return isLoggedIn ? <Navigate to="/" replace /> : children
}

function DoraWidgetGate() {
  const { isLoggedIn } = useAuth()
  if (!isLoggedIn) return null
  return <DoraWidget />
}

// Satu instance TeamLayout dipakai bareng oleh semua route di dalamnya (lewat <Outlet />),
// jadi sidebar + header tidak remount pas pindah halaman - ini yang bikin preventScrollReset kepakai.
function PrivateTeamLayout(props: { wide?: boolean; storageKey?: string; defaultCollapsed?: boolean }) {
  return (
    <PrivateRoute>
      <TeamLayout {...props} />
    </PrivateRoute>
  )
}

function AppRoutes() {
  const location = useLocation()
  const state = location.state as { backgroundLocation?: Location } | null
  const mainLocation = state?.backgroundLocation || location

  return (
    <>
      <Routes location={mainLocation}>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><Dashboard /></PrivateRoute>} />

        <Route element={<PrivateTeamLayout storageKey="teams_sidebar_collapsed" />}>
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:projectId" element={<ProjectDetail />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/teams/:divisiId" element={<TeamDivisionMembers />} />
          <Route path="/teams/:divisiId/:pegawaiId" element={<PegawaiTasks />} />
        </Route>

        <Route element={<PrivateTeamLayout wide storageKey="teamboard_sidebar_collapsed" defaultCollapsed />}>
          <Route path="/teams/:divisiId/team-board" element={<TeamBoard />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {location.pathname === '/settings' && (
        <PrivateRoute>
          <Settings />
        </PrivateRoute>
      )}
      <PrivateRoute>
        <DoraWidgetGate />
      </PrivateRoute>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollRestorationProvider>
        <AppRoutes />
      </ScrollRestorationProvider>
    </BrowserRouter>
  )
}