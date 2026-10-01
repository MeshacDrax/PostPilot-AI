import { useState } from "react";
import { useEffect } from "react";
import { api } from "../services/api";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BarChart3, CalendarDays, ChevronDown, Command, FileText, Hash, LayoutDashboard,
  Lightbulb, LogOut, Menu, PenLine, Settings, Sparkles, Tags, UsersRound, X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Notice } from "../components/UI";

const navigation = [
  { label: "Overview", path: "/app", icon: LayoutDashboard, end: true },
  { label: "Generate content", path: "/app/generate", icon: PenLine },
  { label: "My content", path: "/app/content", icon: FileText },
  { label: "Templates", path: "/app/templates", icon: Tags },
  { label: "Content ideas", path: "/app/ideas", icon: Lightbulb },
  { label: "Hashtags", path: "/app/hashtags", icon: Hash },
  { label: "Calendar", path: "/app/calendar", icon: CalendarDays },
  { label: "Brand kit", path: "/app/brands", icon: UsersRound },
  { label: "Analytics", path: "/app/analytics", icon: BarChart3 },
];

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [usage, setUsage] = useState<{ plan: string; used: number; limit: number } | null>(null);
  const [usageError, setUsageError] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    void api.get("/subscription")
      .then(({ data }) => setUsage({
        plan: data.subscription.plan,
        used: data.subscription.usage.generations,
        limit: data.subscription.limits.generations,
      }))
      .catch(() => setUsageError(true));
  }, []);
  const logout = async () => {
    setLogoutError("");
    try {
      await signOut();
      navigate("/");
    } catch {
      setLogoutError("Couldn't sign out right now. Please try again.");
    }
  };
  return (
    <div className="workspace">
      {menuOpen && <button aria-label="Close navigation" className="sidebar-scrim" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? "mobile-open" : ""}`}>
        <NavLink to="/app" className="brand-lockup" onClick={() => setMenuOpen(false)}>
          <span className="brand-symbol"><Command size={18} strokeWidth={2.4} /></span>
          <span>postpilot<span className="brand-ai">.ai</span></span>
        </NavLink>
        <div className="workspace-switcher">
          <div className="workspace-avatar">P</div>
          <div className="workspace-info"><strong>Personal workspace</strong><span>{usage ? `${usage.plan[0]}${usage.plan.slice(1).toLowerCase()} plan` : "Loading plan…"}</span></div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="side-nav">
          {navigation.map(({ label, path, icon: Icon, end }) => (
            <NavLink key={path} to={path} end={end} onClick={() => setMenuOpen(false)} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
              {label === "Generate content" && <span className="nav-sparkle"><Sparkles size={14} /></span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="usage-card">
            <div className="usage-card-top"><span>{usage ? `${usage.plan[0]}${usage.plan.slice(1).toLowerCase()} plan` : "Plan usage"}</span><span>{usage ? `${usage.used} / ${usage.limit}` : usageError ? "Unavailable" : "…"}</span></div>
            <div className="usage-bar"><span style={{ width: usage ? `${Math.min(100, usage.used / usage.limit * 100)}%` : "0%" }} /></div>
            <p>{usageError ? "Usage couldn't be loaded" : "Generations this month"}</p>
            <NavLink to="/app/subscription">Explore plans <span>→</span></NavLink>
          </div>
          <NavLink to="/app/subscription" className="nav-item"><Sparkles size={18} /><span>Subscription</span></NavLink>
          <NavLink to="/app/settings" className="nav-item"><Settings size={18} /><span>Settings</span></NavLink>
          <div className="user-profile">
            <div className="user-avatar">{user?.name?.charAt(0).toUpperCase()}</div>
            <div className="user-details"><strong>{user?.name}</strong><span>{user?.email}</span></div>
            <button className="icon-button" onClick={() => void logout()} aria-label="Log out"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>
      <main className="main-panel">
        <header className="mobile-topbar">
          <button className="icon-button" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <span className="brand-lockup compact"><span className="brand-symbol"><Command size={17} /></span>postpilot<span className="brand-ai">.ai</span></span>
          <button className="icon-button" onClick={() => void logout()} aria-label="Log out"><LogOut size={18} /></button>
        </header>
        <div className="workspace-content">{logoutError && <Notice message={logoutError} />}<Outlet /></div>
      </main>
    </div>
  );
}
