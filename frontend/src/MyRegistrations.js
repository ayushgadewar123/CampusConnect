import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { FaCalendarAlt, FaMapMarkerAlt, FaCheckCircle, FaClock, FaHourglassHalf, FaTicketAlt, FaRedo, FaTimes } from "react-icons/fa";
import api from "./lib/api";
import QrPattern from "./components/QrPattern";
import AsyncState from "./components/AsyncState";

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBA";
  return date.toLocaleDateString();
}

export default function MyRegistrations() {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchRegistrations = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/api/registrations/my");
      setRegistrations(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      const message = err.response?.data?.message || "Failed to load registrations";
      setError(message);
      toast.error(message);
      setRegistrations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRegistrations(); }, [fetchRegistrations]);

  const handleCancel = async (eventId) => {
    try {
      await api.delete(`/api/registrations/${eventId}`);
      toast.success("Registration cancelled");
      fetchRegistrations();
    } catch (err) {
      toast.error(err.response?.data?.message || "Cancel failed");
    }
  };

  const handleReregister = async (eventId) => {
    try {
      await api.post(`/api/registrations/${eventId}`);
      toast.success("Registration restored");
      fetchRegistrations();
    } catch (err) {
      toast.error(err.response?.data?.message || "Re-register failed");
    }
  };

  const grouped = useMemo(() => {
    const safe = registrations.filter((reg) => reg && reg.event && reg.event.title);
    return {
      upcoming: safe.filter((reg) => reg.event.status === "upcoming" && reg.status !== "cancelled"),
      live: safe.filter((reg) => reg.event.status === "live" && reg.status !== "cancelled"),
      completed: safe.filter((reg) => reg.event.status === "completed" && reg.status !== "cancelled"),
      cancelled: safe.filter((reg) => reg.status === "cancelled"),
      waitlisted: safe.filter((reg) => reg.status === "waitlisted"),
      confirmed: safe.filter((reg) => reg.status === "confirmed"),
    };
  }, [registrations]);

  const total = registrations.length;

  const renderCard = (reg) => (
    <motion.article key={reg._id} className="event-card registration-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="event-top">
        <span className="event-tag">{reg.event.category || "Campus Event"}</span>
        <span className={`event-date status-${reg.status}`}>{reg.status}</span>
      </div>
      <h3>{reg.event.title}</h3>
      <p className="clamp-3">{reg.event.description}</p>
      <div className="event-meta"><span><FaCalendarAlt /> {formatDate(reg.event.date)}</span><span><FaMapMarkerAlt /> {reg.event.venue}</span></div>
      <div className="meta-row">
        <span className="badge-pill">{reg.status === "confirmed" ? <FaCheckCircle /> : reg.status === "waitlisted" ? <FaHourglassHalf /> : <FaClock />}{reg.status}</span>
        <span className="badge-pill subtle"><FaTicketAlt /> {reg.ticketCode || (reg.status === "cancelled" ? "Cancelled" : "Pending")}</span>
        <span className="badge-pill subtle">Waitlist: {reg.waitlistPosition || 0}</span>
      </div>
      {reg.ticketCode && reg.status === "confirmed" && (
        <div className="ticket-snippet">
          <QrPattern value={reg.ticketCode} size={15} />
          <div>
            <p className="detail-label">Ticket code</p>
            <strong>{reg.ticketCode}</strong>
            <p className="muted">Use this at check-in.</p>
          </div>
        </div>
      )}
      <div className="card-actions wrap">
        <span className="mini-note">Registered on {formatDate(reg.createdAt)}</span>
        {reg.status !== "cancelled" && <button className="secondary-btn" type="button" onClick={() => handleCancel(reg.event._id)}><FaTimes /> Cancel</button>}
        {reg.status === "cancelled" && <button className="secondary-btn" type="button" onClick={() => handleReregister(reg.event._id)}><FaRedo /> Re-register</button>}
      </div>
    </motion.article>
  );

  return (
    <div className="content-panel">
      <div className="hero-card">
        <div className="hero-copy">
          <span className="hero-badge">My activity</span>
          <h1>Your registrations, waitlist, and attendance status.</h1>
          <p>Track confirmed, upcoming, live, completed, and cancelled events from one timeline.</p>
        </div>
        <div className="hero-stats">
          <div className="stat-card"><strong>{total}</strong><span>Total records</span></div>
          <div className="stat-card"><strong>{grouped.confirmed.length}</strong><span>Confirmed</span></div>
          <div className="stat-card"><strong>{grouped.waitlisted.length}</strong><span>Waitlisted</span></div>
        </div>
      </div>

      {loading ? (
        <AsyncState variant="loading" title="Loading your registrations" description="Fetching your event timeline and ticket history." />
      ) : error ? (
        <AsyncState
          variant="error"
          title="Could not load registrations"
          description={error}
          actionLabel="Try again"
          onAction={fetchRegistrations}
        />
      ) : total === 0 ? (
        <AsyncState
          variant="empty"
          title="No registrations yet"
          description="Explore events and join the ones that match your interests."
          actionLabel="Browse events"
          onAction={() => window.location.assign("/events")}
          secondaryActionLabel="Read announcements"
          onSecondaryAction={() => window.location.assign("/announcements")}
        />
      ) : (
        <div className="stack-grid">
          {grouped.upcoming.length > 0 && <section><div className="section-head compact"><h2>Upcoming</h2></div><div className="event-grid">{grouped.upcoming.map(renderCard)}</div></section>}
          {grouped.live.length > 0 && <section><div className="section-head compact"><h2>Live</h2></div><div className="event-grid">{grouped.live.map(renderCard)}</div></section>}
          {grouped.completed.length > 0 && <section><div className="section-head compact"><h2>Completed</h2></div><div className="event-grid">{grouped.completed.map(renderCard)}</div></section>}
          {grouped.waitlisted.length > 0 && <section><div className="section-head compact"><h2>Waitlisted</h2></div><div className="event-grid">{grouped.waitlisted.map(renderCard)}</div></section>}
          {grouped.cancelled.length > 0 && <section><div className="section-head compact"><h2>Cancelled</h2></div><div className="event-grid">{grouped.cancelled.map(renderCard)}</div></section>}
        </div>
      )}
    </div>
  );
}
