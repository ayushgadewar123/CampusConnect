import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  FaCalendarAlt,
  FaUserShield,
  FaSignOutAlt,
  FaHome,
  FaRegUserCircle,
  FaClipboardList,
  FaBullhorn,
  FaSignInAlt,
  FaUserPlus,
  FaCompass,
  FaTimes,
} from "react-icons/fa";

function SectionLabel({ children }) {
  return <span className="sidebar-label">{children}</span>;
}

export default function Sidebar({ mobileOpen = false, onClose = () => {} }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`);
  const itemClass = (path) => `side-link ${isActive(path) ? "active" : ""}`;

  const handleLogout = () => {
    logout();
    onClose();
    navigate("/login", { replace: true });
  };

  const handleNavigate = (path) => {
    onClose();
    navigate(path);
  };

  return (
    <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
      <div className="sidebar-top">
        <div className="brand-row">
          <div className="brand-block">
            <div className="brand-mark">CC</div>
            <div>
              <h1>CampusConnect</h1>
              <p>College event portal</p>
            </div>
          </div>

          <button
            className="sidebar-close-btn"
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <FaTimes />
          </button>
        </div>

        <nav className="sidebar-nav">
          <SectionLabel>Core modules</SectionLabel>
          <Link to="/home" className={itemClass("/home")} onClick={onClose}><FaHome /> <span>Home</span></Link>
          <Link to="/events" className={itemClass("/events")} onClick={onClose}><FaCalendarAlt /> <span>Events</span></Link>
          <Link to="/announcements" className={itemClass("/announcements")} onClick={onClose}><FaBullhorn /> <span>Announcements</span></Link>

          {user && (
            <>
              <SectionLabel>My space</SectionLabel>
              <Link to="/my-registrations" className={itemClass("/my-registrations")} onClick={onClose}><FaClipboardList /> <span>My registrations</span></Link>
              <Link to="/profile" className={itemClass("/profile")} onClick={onClose}><FaRegUserCircle /> <span>Profile</span></Link>
            </>
          )}

          {['admin', 'super_admin'].includes(user?.role) && (
            <>
              <SectionLabel>Admin</SectionLabel>
              <Link to="/admin" className={itemClass("/admin")} onClick={onClose}><FaUserShield /> <span>Admin dashboard</span></Link>
            </>
          )}
        </nav>
      </div>

      <div className="sidebar-bottom">
        {!user ? (
          <div className="guest-chip">
            <div className="guest-copy">
              <strong>Guest access</strong>
              <span>Browse the portal first, then sign in for event registration.</span>
            </div>
            <div className="guest-actions">
              <button className="secondary-btn tiny" type="button" onClick={() => handleNavigate("/events")}><FaCompass /> <span>Explore</span></button>
              <button className="secondary-btn tiny" type="button" onClick={() => handleNavigate("/login")}>
                <FaSignInAlt /> <span>Sign in</span>
              </button>
              <button className="primary-btn tiny" type="button" onClick={() => handleNavigate("/register")}><FaUserPlus /> <span>Sign up</span></button>
            </div>
          </div>
        ) : (
          <>
            <div className="user-chip">
              <FaRegUserCircle />
              <div>
                <strong>{user.name}</strong>
                <span>{user.role}</span>
              </div>
            </div>
            <button className="logout-btn" onClick={handleLogout} type="button">
              <FaSignOutAlt /> <span>Logout</span>
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
