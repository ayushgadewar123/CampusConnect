import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  FaBell,
  FaCheckCircle,
  FaClock,
  FaEnvelopeOpenText,
  FaExternalLinkAlt,
  FaFilter,
  FaRegCircle,
  FaSave,
  FaStar,
  FaTimes,
} from "react-icons/fa";
import api from "./lib/api";

const DEFAULT_PREFS = { inAppEnabled: true, emailEnabled: true, digestEnabled: true, mutedTypes: [] };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "event", label: "Events" },
  { key: "registration", label: "Registrations" },
  { key: "announcement", label: "Announcements" },
  { key: "reminder", label: "Reminders" },
  { key: "security", label: "Security" },
  { key: "system", label: "System" },
];

const TYPE_LABELS = {
  system: "System",
  announcement: "Announcement",
  registration: "Registration",
  waitlist: "Waitlist",
  promotion: "Promotion",
  volunteer: "Volunteer",
  certificate: "Certificate",
  reminder: "Reminder",
  event: "Event",
  security: "Security",
};

function timeAgo(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function notificationIcon(type, isRead) {
  const tone = isRead ? "muted" : "active";
  switch (String(type || "system")) {
    case "announcement":
      return <FaStar className={`notification-type-icon ${tone}`} />;
    case "registration":
    case "waitlist":
    case "volunteer":
      return <FaCheckCircle className={`notification-type-icon ${tone}`} />;
    case "reminder":
    case "event":
      return <FaClock className={`notification-type-icon ${tone}`} />;
    case "security":
      return <FaBell className={`notification-type-icon ${tone}`} />;
    default:
      return <FaRegCircle className={`notification-type-icon ${tone}`} />;
  }
}

export default function Notifications() {
  const [loading, setLoading] = useState(true);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState("all");
  const [preferences, setPreferences] = useState(DEFAULT_PREFS);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setPrefsLoading(true);
    try {
      const [notifRes, prefRes] = await Promise.all([
        api.get("/api/notifications"),
        api.get("/api/settings/notifications").catch(() => ({ data: { preferences: DEFAULT_PREFS } })),
      ]);

      setNotifications(Array.isArray(notifRes.data?.notifications) ? notifRes.data.notifications : []);
      setUnreadCount(Number(notifRes.data?.unreadCount || 0));
      setPreferences({ ...DEFAULT_PREFS, ...(prefRes.data?.preferences || {}) });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load notifications");
    } finally {
      setLoading(false);
      setPrefsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handleRefresh = () => fetchData();
    window.addEventListener("notifications:updated", handleRefresh);
    return () => window.removeEventListener("notifications:updated", handleRefresh);
  }, [fetchData]);

  const visibleNotifications = useMemo(() => {
    const muted = new Set((preferences.mutedTypes || []).map((item) => String(item).toLowerCase()));
    return [...notifications]
      .filter((item) => !muted.has(String(item.type || "system").toLowerCase()))
      .filter((item) => {
        if (filter === "all") return true;
        if (filter === "unread") return !item.isRead;
        return String(item.type || "system") === filter;
      })
      .sort((a, b) => {
        const aUnread = a.isRead ? 1 : 0;
        const bUnread = b.isRead ? 1 : 0;
        if (aUnread !== bUnread) return aUnread - bUnread;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
  }, [filter, notifications, preferences.mutedTypes]);

  const updatePreference = (key, value) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  const toggleMutedType = (type) => {
    setPreferences((prev) => {
      const current = new Set(prev.mutedTypes || []);
      if (current.has(type)) current.delete(type);
      else current.add(type);
      return { ...prev, mutedTypes: Array.from(current) };
    });
  };

  const markAllRead = async () => {
    try {
      await api.patch("/api/notifications/read-all");
      window.dispatchEvent(new Event("notifications:updated"));
      toast.success("Inbox cleared");
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to update notifications");
    }
  };

  const markRead = async (id) => {
    try {
      await api.patch(`/api/notifications/${id}/read`);
      window.dispatchEvent(new Event("notifications:updated"));
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not mark notification read");
    }
  };

  const dismiss = async (id) => {
    try {
      await api.delete(`/api/notifications/${id}`);
      window.dispatchEvent(new Event("notifications:updated"));
      toast.success("Notification removed");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to remove notification");
    }
  };

  const savePreferences = async () => {
    try {
      setSavingPrefs(true);
      const res = await api.patch("/api/settings/notifications", {
        inAppEnabled: preferences.inAppEnabled,
        emailEnabled: preferences.emailEnabled,
        digestEnabled: preferences.digestEnabled,
        mutedTypes: preferences.mutedTypes,
      });
      setPreferences({ ...DEFAULT_PREFS, ...(res.data?.preferences || {}) });
      toast.success("Notification preferences saved");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not save preferences");
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <div className="content-panel notifications-page">
      <section className="hero-card notifications-hero">
        <div className="hero-copy">
          <span className="hero-badge">Bell inbox</span>
          <h1>Everything new lands here first.</h1>
          <p>A focused notification feed with unread-first ordering, so it feels more like a real inbox and less like a mixed feed.</p>
          <div className="button-row hero-actions">
            <button className="primary-btn" type="button" onClick={markAllRead}>
              <FaEnvelopeOpenText /> Mark all read
            </button>
            <button className="secondary-btn" type="button" onClick={fetchData}>
              Refresh inbox <FaExternalLinkAlt />
            </button>
          </div>
        </div>

        <div className="hero-stats notification-hero-stats">
          <div className="stat-card">
            <strong>{unreadCount}</strong>
            <span>Unread</span>
          </div>
          <div className="stat-card">
            <strong>{notifications.length}</strong>
            <span>Total items</span>
          </div>
          <div className="stat-card">
            <strong>{visibleNotifications.length}</strong>
            <span>Visible now</span>
          </div>
        </div>
      </section>

      <section className="card-surface">
        <div className="section-head compact">
          <div>
            <h2>Inbox filters</h2>
            <p className="muted">Notifications only. No announcements or calendar items mixed in.</p>
          </div>
          <div className="section-icon"><FaFilter /></div>
        </div>

        <div className="tag-row notifications-tabs">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`mini-tag ${filter === item.key ? "active" : ""}`}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="skeleton-grid">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      ) : visibleNotifications.length === 0 ? (
        <div className="empty-state">
          <strong>No notifications match this view</strong>
          <p>Tweak the filter or refresh the inbox to check for new activity.</p>
          <div className="empty-actions">
            <button className="primary-btn" type="button" onClick={fetchData}>Refresh inbox</button>
            <Link className="secondary-btn" to="/events">Browse events</Link>
          </div>
        </div>
      ) : (
        <div className="notification-list">
          {visibleNotifications.map((item) => (
            <motion.article
              key={item._id}
              className={`notification-card ${item.isRead ? "" : "unread"}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="notification-icon">{notificationIcon(item.type, item.isRead)}</div>
              <div className="notification-body">
                <div className="notification-row">
                  <div className="notification-title-row">
                    <h3>{item.title}</h3>
                    {!item.isRead && <span className="notification-dot" aria-hidden="true" />}
                  </div>
                  <span className="badge-pill subtle">{TYPE_LABELS[item.type] || "Update"}</span>
                </div>
                <p>{item.message}</p>
                <div className="notification-meta">
                  <span>{timeAgo(item.createdAt)}</span>
                  {item.link ? <span>Linked update</span> : <span>In-app update</span>}
                </div>
              </div>
              <div className="notification-actions">
                {item.link && (
                  <a className="secondary-btn tiny" href={item.link}>
                    Open <FaExternalLinkAlt />
                  </a>
                )}
                {!item.isRead && (
                  <button className="secondary-btn tiny" type="button" onClick={() => markRead(item._id)}>
                    Mark read
                  </button>
                )}
                <button className="icon-pill" type="button" onClick={() => dismiss(item._id)} aria-label="Dismiss notification">
                  <FaTimes />
                </button>
              </div>
            </motion.article>
          ))}
        </div>
      )}

      <section className="card-surface">
        <div className="section-head compact">
          <div>
            <h2>Delivery settings</h2>
            <p className="muted">Keep the inbox clean by muting only the types you do not need.</p>
          </div>
          <div className="section-icon"><FaSave /></div>
        </div>

        {prefsLoading ? (
          <div className="skeleton-grid">
            <div className="skeleton-card" />
          </div>
        ) : (
          <>
            <div className="field-grid two">
              <label className="toggle-pill"><input type="checkbox" checked={preferences.inAppEnabled} onChange={(e) => updatePreference("inAppEnabled", e.target.checked)} /> In-app notifications</label>
              <label className="toggle-pill"><input type="checkbox" checked={preferences.emailEnabled} onChange={(e) => updatePreference("emailEnabled", e.target.checked)} /> Email notifications</label>
              <label className="toggle-pill"><input type="checkbox" checked={preferences.digestEnabled !== false} onChange={(e) => updatePreference("digestEnabled", e.target.checked)} /> Daily digest emails</label>
            </div>

            <div className="tag-row" style={{ marginTop: 16 }}>
              {Object.keys(TYPE_LABELS).map((type) => {
                const active = (preferences.mutedTypes || []).includes(type);
                return (
                  <button key={type} className={`mini-tag ${active ? "active" : ""}`} type="button" onClick={() => toggleMutedType(type)}>
                    {active ? <FaTimes /> : <FaBell />} {TYPE_LABELS[type]}
                  </button>
                );
              })}
            </div>

            <div className="card-actions wrap" style={{ marginTop: 18 }}>
              <button className="primary-btn" type="button" onClick={savePreferences} disabled={savingPrefs}>
                <FaSave /> {savingPrefs ? "Saving..." : "Save preferences"}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
