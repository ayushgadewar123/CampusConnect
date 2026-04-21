import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaArrowRight,
  FaCalendarAlt,
  FaExternalLinkAlt,
  FaMapMarkerAlt,
  FaStar,
  FaTrophy,
  FaUsers,
  FaBullhorn,
} from "react-icons/fa";
import api from "./lib/api";
import { useAuth } from "./context/AuthContext";

function formatDate(value) {
  if (!value) return "TBA";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBA";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function pickAccent(event) {
  if (!event?.category) return "General";
  return String(event.category);
}

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

export default function Home() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [registeredIds, setRegisteredIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [heroNote, setHeroNote] = useState("");

  useEffect(() => {
    const messages = [
      "A calmer dashboard for your campus project.",
      "Core actions first: events, registrations, and notices.",
      "Built to look polished without becoming hard to explain.",
    ];
    setHeroNote(messages[new Date().getDate() % messages.length]);
  }, []);

  useEffect(() => {
    let active = true;
    async function loadHome() {
      setLoading(true);
      setAnnouncementsLoading(true);
      try {
        const [eventsRes, registrationsRes, announcementsRes] = await Promise.all([
          api.get("/api/events", { params: { sort: "soonest" } }),
          token ? api.get("/api/registrations/my") : Promise.resolve({ data: [] }),
          api.get("/api/announcements").catch(() => ({ data: [] })),
        ]);

        if (!active) return;
        setEvents(Array.isArray(eventsRes.data) ? eventsRes.data : []);
        setRegisteredIds(
          Array.isArray(registrationsRes.data)
            ? registrationsRes.data
                .map((item) => item?.event?._id || item?.event)
                .filter(Boolean)
            : []
        );
        setAnnouncements(Array.isArray(announcementsRes.data) ? announcementsRes.data : []);
      } catch {
        if (!active) return;
        setEvents([]);
        setRegisteredIds([]);
        setAnnouncements([]);
      } finally {
        if (active) {
          setLoading(false);
          setAnnouncementsLoading(false);
        }
      }
    }

    loadHome();
    return () => {
      active = false;
    };
  }, [token]);

  const featuredEvents = useMemo(() => {
    const featured = events.filter((event) => event.featured);
    return [...featured, ...events.filter((event) => !event.featured)].slice(0, 3);
  }, [events]);

  const latestAnnouncements = useMemo(() => announcements.slice(0, 4), [announcements]);

  const stats = useMemo(() => {
    const total = events.length;
    const live = events.filter((event) => event.status === "live").length;
    const upcoming = events.filter((event) => event.status === "upcoming" || event.status === "published").length;
    return {
      total,
      live,
      upcoming,
      registered: registeredIds.length,
      announcements: announcements.length,
    };
  }, [events, registeredIds, announcements]);

  const openEvent = (event) => navigate(`/events/${event._id}`);

  return (
    <div className="content-panel home-page">
      <section className="hero-card home-hero">
        <div className="hero-copy">
          <span className="hero-badge">Student dashboard</span>
          <h1>A cleaner dashboard for campus events, registrations, and notices.</h1>
          <p>{heroNote || "A cleaner entry point with the most useful actions first."}</p>
          <div className="button-row hero-actions">
            {user ? (
              <>
                <Link className="primary-btn" to="/events">
                  Open event explorer <FaArrowRight />
                </Link>
                <Link className="secondary-btn" to="/notifications">
                  View notifications <FaExternalLinkAlt />
                </Link>
              </>
            ) : (
              <>
                <Link className="primary-btn" to="/register">
                  Create account <FaArrowRight />
                </Link>
                <Link className="secondary-btn" to="/events">
                  Explore as guest <FaCalendarAlt />
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="home-hero-panel">
          <div className="hero-panel-top">
            <div className="home-avatar">{user?.name?.slice(0, 1)?.toUpperCase() || "G"}</div>
            <div>
              <p className="eyebrow">Welcome</p>
              <h3>{user ? user.name : "Guest visitor"}</h3>
              <p className="muted">{user ? `${user.role} access` : "Browse public events and sign in for full access."}</p>
            </div>
          </div>
          <div className="mini-stats home-mini-stats">
            <div className="mini-card">
              <strong>{stats.total}</strong>
              <span>Total events</span>
            </div>
            <div className="mini-card">
              <strong>{stats.upcoming}</strong>
              <span>Upcoming</span>
            </div>
            <div className="mini-card">
              <strong>{stats.live}</strong>
              <span>Live now</span>
            </div>
            <div className="mini-card">
              <strong>{stats.registered}</strong>
              <span>Registered</span>
            </div>
            <div className="mini-card">
              <strong>{stats.announcements}</strong>
              <span>Announcements</span>
            </div>
          </div>
        </div>
      </section>

      <section className="card-surface home-section">
        <div className="section-head compact">
          <div>
            <h2>Latest announcements</h2>
            <p className="muted">Latest notices from the department and event team.</p>
          </div>
          <div className="section-icon"><FaBullhorn /></div>
        </div>

        {announcementsLoading ? (
          <div className="skeleton-grid home-skeleton-grid">
            {Array.from({ length: 4 }).map((_, index) => <div key={index} className="skeleton-card" />)}
          </div>
        ) : latestAnnouncements.length === 0 ? (
          <div className="empty-state">
            <p>No announcements are available yet.</p>
            <Link className="secondary-btn" to="/announcements">Open announcements</Link>
          </div>
        ) : (
          <div className="timeline-list">
            {latestAnnouncements.map((item) => (
              <article key={item._id} className="notification-card">
                <div className="notification-icon"><FaBullhorn /></div>
                <div>
                  <h3>{item.title}</h3>
                  <p className="clamp-3">{item.message}</p>
                  <p className="muted">{item.audience} • {item.createdBy?.name || "Campus team"} • {timeAgo(item.createdAt)}</p>
                </div>
                <div className="card-actions wrap">
                  {item.isPinned ? <span className="badge-pill subtle">Pinned</span> : <span className="badge-pill subtle">Fresh</span>}
                  <Link className="secondary-btn tiny" to="/announcements">Open feed</Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card-surface home-section">
        <div className="section-head compact">
          <div>
            <h2>Spotlight events</h2>
            <p className="muted">A short preview of events that matter most right now.</p>
          </div>
          <div className="section-icon"><FaStar /></div>
        </div>

        {loading ? (
          <div className="skeleton-grid home-skeleton-grid">
            {Array.from({ length: 3 }).map((_, index) => <div key={index} className="skeleton-card" />)}
          </div>
        ) : featuredEvents.length === 0 ? (
          <div className="empty-state">
            <p>No spotlight events are available yet.</p>
            <Link className="secondary-btn" to="/events">Browse all events</Link>
          </div>
        ) : (
          <div className="spotlight-grid">
            {featuredEvents.map((event) => (
              <article key={event._id} className="event-card spotlight-card" role="button" tabIndex={0} onClick={() => openEvent(event)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openEvent(event)}>
                <div className="event-card-top">
                  <div className="event-icon"><FaUsers /></div>
                  <div className="event-card-meta">
                    <span className="event-tag">{pickAccent(event)}</span>
                    <span className={`event-status status-${String(event.status || "draft").replace(/\s+/g, "-")}`}>{event.status || "draft"}</span>
                  </div>
                </div>
                <h3>{event.title}</h3>
                <p className="clamp-3">{event.description}</p>
                <div className="event-info-line">
                  <span><FaCalendarAlt /> {formatDate(event.date)}</span>
                  <span><FaMapMarkerAlt /> {event.venue || "TBA"}</span>
                </div>
                <div className="card-actions wrap">
                  {registeredIds.includes(event._id) ? <span className="badge-pill success">Registered</span> : <span className="badge-pill subtle">Open</span>}
                  <span className="badge-pill subtle">{safeArray(event.registrations).length || event.capacity || 0} seats</span>
                  <button className="secondary-btn tiny" type="button" onClick={(e) => { e.stopPropagation(); openEvent(event); }}>View event <FaArrowRight /></button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card-surface home-section">
        <div className="section-head compact">
          <div>
            <h2>Quick links</h2>
            <p className="muted">Useful shortcuts without crowding the page.</p>
          </div>
          <div className="section-icon"><FaCalendarAlt /></div>
        </div>

        <div className="home-shortcuts">
          <Link className="shortcut-card" to="/events">
            <FaCalendarAlt />
            <div>
              <strong>Events</strong>
              <span>Open the event explorer</span>
            </div>
          </Link>
          <Link className="shortcut-card" to="/my-registrations">
            <FaTrophy />
            <div>
              <strong>Registrations</strong>
              <span>Track your activity</span>
            </div>
          </Link>
          <Link className="shortcut-card" to="/announcements">
            <FaBullhorn />
            <div>
              <strong>Announcements</strong>
              <span>Read the latest notices</span>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
