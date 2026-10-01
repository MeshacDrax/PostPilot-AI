import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { AppLayout } from "./layouts/AppLayout";
import { AuthPage, ForgotPasswordPage } from "./pages/AuthPages";
import { LandingPage } from "./pages/LandingPage";
import {
  AnalyticsPage, BrandsPage, CalendarPage, DashboardPage, GeneratorPage,
  IdeasPage, LibraryPage, SubscriptionPage, TemplatesPage, HashtagsPage, SettingsPage,
} from "./pages/WorkspacePages";

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="screen-loader"><span className="spinner" /> Loading your workspace…</div>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/register" element={<AuthPage register />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/app" element={<Protected><AppLayout /></Protected>}>
        <Route index element={<DashboardPage />} />
        <Route path="generate" element={<GeneratorPage />} />
        <Route path="content" element={<LibraryPage />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="ideas" element={<IdeasPage />} />
        <Route path="hashtags" element={<HashtagsPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="brands" element={<BrandsPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="subscription" element={<SubscriptionPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
