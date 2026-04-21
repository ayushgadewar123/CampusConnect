import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "./context/AuthContext";
import {
  FaCalendarAlt,
  FaUserShield,
  FaSignOutAlt,
  FaHome,
  FaChevronLeft,
  FaChevronRight,
  FaRegUserCircle,
  FaIdBadge,
  FaClipboardList,
  FaTrophy,
  FaMedal,
  FaBookmark,
  FaBullhorn,
  FaTools,
  FaBarcode,
  FaServer,
} from "react-icons/fa";

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`);
  const itemClass = (path) => `side-link ${isActive(path) ? "active" : ""}`;

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-top">
        <div className="brand-row">
          <div className="brand-block">
            <div className="brand-mark">CC</div>
            {!collapsed && (
              <div>
                <h1>CampusConnect</h1>
                <p>Event portal</p>
              </div>
            )}
          </div>

          <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)} type="button" aria-label="Toggle sidebar">
            {collapsed ? <FaChevronRight /> : <FaChevronLeft />}
          </button>
        </div>
      </div>

      <div className="sidebar-nav">
        <div className="sidebar-group">
          {!collapsed && <span className="sidebar-label">Explore</span>}
          <Link to="/home" className={itemClass("/home")}><FaHome /> {!collapsed && <span>Home</span>}</Link>
          <Link to="/events" className={itemClass("/events")}><FaCalendarAlt /> {!collapsed && <span>Events</span>}</Link>
          <Link to="/wishlist" className={itemClass("/wishlist")}><FaBookmark /> {!collapsed && <span>Wishlist</span>}</Link>
          <Link to="/announcements" className={itemClass("/announcements")}><FaBullhorn /> {!collapsed && <span>Announcements</span>}</Link>
        </div>

        {user && (
          <div className="sidebar-group">
            {!collapsed && <span className="sidebar-label">Student space</span>}
            <Link to="/calendar" className={itemClass("/calendar")}><FaCalendarAlt /> {!collapsed && <span>Calendar</span>}</Link>
            <Link to="/my-registrations" className={itemClass("/my-registrations")}><FaClipboardList /> {!collapsed && <span>My Registrations</span>}</Link>
            <Link to="/achievements" className={itemClass("/achievements")}><FaMedal /> {!collapsed && <span>Achievements</span>}</Link>
            <Link to="/profile" className={itemClass("/profile")}><FaIdBadge /> {!collapsed && <span>Profile</span>}</Link>
            <Link to="/volunteer" className={itemClass("/volunteer")}><FaClipboardList /> {!collapsed && <span>Volunteer</span>}</Link>
          </div>
        )}

        {['admin', 'super_admin'].includes(user?.role) && (
          <div className="sidebar-group">
            {!collapsed && <span className="sidebar-label">Admin</span>}
            <Link to="/admin" className={itemClass("/admin")}><FaUserShield /> {!collapsed && <span>Admin Dashboard</span>}</Link>
            <Link to="/admin/tools" className={itemClass("/admin/tools")}><FaTools /> {!collapsed && <span>Admin Tools</span>}</Link>
            <Link to="/admin/logs" className={itemClass("/admin/logs")}><FaTrophy /> {!collapsed && <span>Audit Logs</span>}</Link>
            <Link to="/admin/check-in" className={itemClass("/admin/check-in")}><FaBarcode /> {!collapsed && <span>Check-in Desk</span>}</Link>
            <Link to="/admin/system" className={itemClass("/admin/system")}><FaServer /> {!collapsed && <span>System Status</span>}</Link>
          </div>
        )}
      </div>

      <div className="sidebar-bottom">
        {!collapsed && user && (
          <div className="user-chip">
            <FaRegUserCircle />
            <div>
              <strong>{user.name}</strong>
              <span>{user.role}</span>
            </div>
          </div>
        )}
        <button className="logout-btn" onClick={handleLogout} type="button">
          <FaSignOutAlt /> {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
