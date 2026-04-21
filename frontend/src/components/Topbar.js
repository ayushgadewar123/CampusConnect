import { useEffect, useState } from "react";
import { FaBell, FaMoon, FaSun, FaBars } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import api from "../lib/api";

const routeTitles = [
  { match: /^\/$/, title: "Home" },
  { match: /^\/home$/, title: "Dashboard" },
  { match: /^\/events\/[^/]+$/, title: "Event details" },
  { match: /^\/events$/, title: "Events" },
  { match: /^\/wishlist$/, title: "Saved events" },
  { match: /^\/announcements$/, title: "Announcements" },
  { match: /^\/calendar$/, title: "Calendar" },
  { match: /^\/notifications$/, title: "Notifications" },
  { match: /^\/profile$/, title: "Profile" },
  { match: /^\/admin(\/.*)?$/, title: "Admin dashboard" },
];

export default function Topbar({ onMenuClick = () => {} }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let alive = true;

    const loadUnread = async () => {
      if (!user) {
        if (alive) setUnreadCount(0);
        return;
      }

      try {
        const res = await api.get("/api/notifications?unreadOnly=true");
        if (alive) setUnreadCount(Number(res.data?.unreadCount || 0));
      } catch {
        if (alive) setUnreadCount(0);
      }
    };

    loadUnread();
    const handleUpdate = () => loadUnread();
    window.addEventListener("notifications:updated", handleUpdate);

    return () => {
      alive = false;
      window.removeEventListener("notifications:updated", handleUpdate);
    };
  }, [user, location.pathname]);

  const activeTitle = routeTitles.find((item) => item.match.test(location.pathname))?.title
    || (user?.role && ["admin", "super_admin"].includes(user.role) ? "Admin dashboard" : "Student dashboard");

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="mobile-menu-btn" type="button" onClick={onMenuClick} aria-label="Open navigation">
          <FaBars />
        </button>
        <div>
          <p className="eyebrow">CampusConnect</p>
          <h2>{activeTitle}</h2>
          <p className="topbar-subtitle">A clean full-stack portal for events, registrations, and notices.</p>
        </div>
      </div>

      <div className="topbar-actions">
        {user && (
          <button className="icon-pill notification-bell" type="button" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} onClick={() => navigate("/notifications")}>
            <FaBell />
            {unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
          </button>
        )}
        <button className="icon-pill" type="button" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === "dark" ? <FaSun /> : <FaMoon />}
        </button>
        <div className="topbar-user">
          <div className="avatar">{user?.name?.slice(0, 1)?.toUpperCase() || "G"}</div>
          <div className="topbar-user-info">
            <strong>{user ? user.name : "Guest"}</strong>
            <span>{user ? user.role : "visitor"}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
