import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { RequireAuth, RedirectIfAuth } from "./components/Guards";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import Lobby from "./pages/Lobby";
import DebateRoom from "./pages/DebateRoom";
import Leaderboard from "./pages/Leaderboard";
import History from "./pages/History";
import ReportPage from "./pages/ReportPage";
import AdminPanel from "./pages/AdminPanel";
import ProfilePage from "./pages/ProfilePage";
import NotFound from "./pages/NotFound";
import "./styles/globals.css";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/login"
              element={
                <RedirectIfAuth>
                  <AuthPage mode="login" />
                </RedirectIfAuth>
              }
            />
            <Route
              path="/register"
              element={
                <RedirectIfAuth>
                  <AuthPage mode="register" />
                </RedirectIfAuth>
              }
            />
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/lobby"
              element={
                <RequireAuth>
                  <Lobby />
                </RequireAuth>
              }
            />
            <Route
              path="/debate/:roomId"
              element={
                <RequireAuth>
                  <DebateRoom />
                </RequireAuth>
              }
            />
            <Route
              path="/leaderboard"
              element={
                <RequireAuth>
                  <Leaderboard />
                </RequireAuth>
              }
            />
            <Route
              path="/history"
              element={
                <RequireAuth>
                  <History />
                </RequireAuth>
              }
            />
            <Route
              path="/report/:roomId"
              element={
                <RequireAuth>
                  <ReportPage />
                </RequireAuth>
              }
            />
            <Route
              path="/profile"
              element={
                <RequireAuth>
                  <ProfilePage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <AdminPanel />
                </RequireAuth>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
