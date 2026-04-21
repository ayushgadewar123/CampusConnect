import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import {
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaShareAlt,
  FaBookmark,
  FaRegBookmark,
  FaUsers,
  FaClock,
  FaTicketAlt,
  FaCheckCircle,
  FaRedo,
  FaStar,
} from "react-icons/fa";
import api from "./lib/api";
import { useAuth } from "./context/AuthContext";
import getSocket from "./lib/socket";
import QrPattern from "./components/QrPattern";

function formatDate(value) {
  if (!value) return "TBA";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBA";
  return date.toLocaleString();
}

function listText(value) {
  if (!value) return "Not provided";
  return Array.isArray(value) ? value.join(", ") : String(value);
}

const starValues = [1, 2, 3, 4, 5];

export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [event, setEvent] = useState(null);
  const [registration, setRegistration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookmarks, setBookmarks] = useState([]);
  const [feedback, setFeedback] = useState({ averageRating: 0, total: 0, feedbacks: [] });
  const [feedbackForm, setFeedbackForm] = useState({ rating: 5, comment: "" });
  const [savingFeedback, setSavingFeedback] = useState(false);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("campusconnect-bookmarks") || "[]");
    setBookmarks(Array.isArray(saved) ? saved : []);
  }, []);

  useEffect(() => {
    if (!token) return;
    let mounted = true;
    api.get("/api/wishlist")
      .then((res) => {
        const ids = Array.isArray(res.data?.wishlist) ? res.data.wishlist.map((item) => String(item._id || item)) : [];
        if (mounted) {
          setBookmarks(ids);
          localStorage.setItem("campusconnect-bookmarks", JSON.stringify(ids));
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [token]);

  const persistBookmarks = (next) => {
    setBookmarks(next);
    localStorage.setItem("campusconnect-bookmarks", JSON.stringify(next));
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [eventRes, myRegsRes, feedbackRes] = await Promise.all([
        api.get(`/api/events/${id}`),
        user ? api.get("/api/registrations/my") : Promise.resolve({ data: [] }),
        api.get(`/api/feedback/${id}`),
      ]);
      setEvent(eventRes.data || null);
      const match = Array.isArray(myRegsRes.data) ? myRegsRes.data.find((item) => String(item?.event?._id || item?.event) === String(id)) : null;
      setRegistration(match || null);
      setFeedback({
        averageRating: Number(feedbackRes.data?.averageRating || 0),
        total: Number(feedbackRes.data?.total || 0),
        feedbacks: Array.isArray(feedbackRes.data?.feedbacks) ? feedbackRes.data.feedbacks : [],
      });
      const mine = Array.isArray(feedbackRes.data?.feedbacks) ? feedbackRes.data.feedbacks.find((item) => String(item.user?._id) === String(user?._id)) : null;
      if (mine) {
        setFeedbackForm({ rating: mine.rating || 5, comment: mine.comment || "" });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not load event");
      navigate("/events", { replace: true });
    } finally {
      setLoading(false);
    }
  }, [id, navigate, user]);

  useEffect(() => {
    const socket = getSocket();
    socket.emit("join:event", id);
    const refresh = () => fetchData();
    socket.on("registration:update", refresh);
    socket.on("waitlist:update", refresh);
    socket.on("event:update", refresh);
    return () => {
      socket.emit("leave:event", id);
      socket.off("registration:update", refresh);
      socket.off("waitlist:update", refresh);
      socket.off("event:update", refresh);
    };
  }, [fetchData, id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const register = async () => {
    if (!user) {
      toast.error("Please login first");
      navigate("/login");
      return;
    }
    try {
      await api.post(`/api/registrations/${id}`);
      toast.success("Registration saved");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Registration failed");
    }
  };

  const cancelRegistration = async () => {
    try {
      await api.delete(`/api/registrations/${id}`);
      toast.success("Registration cancelled");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Cancel failed");
    }
  };

  const submitFeedback = async () => {
    if (!user) {
      toast.error("Please login first");
      navigate("/login");
      return;
    }
    try {
      setSavingFeedback(true);
      await api.post(`/api/feedback/${id}`, feedbackForm);
      toast.success("Feedback saved");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Feedback failed");
    } finally {
      setSavingFeedback(false);
    }
  };

  const toggleBookmark = async () => {
    if (token) {
      try {
        const res = await api.post(`/api/wishlist/${id}`);
        const next = Array.isArray(res.data?.wishlist) ? res.data.wishlist.map((item) => String(item)) : [];
        persistBookmarks(next);
        toast.success(res.data?.message || (bookmarks.includes(id) ? "Bookmark removed" : "Saved to bookmarks"));
        return;
      } catch (error) {
        toast.error(error.response?.data?.message || "Wishlist update failed");
        return;
      }
    }
    const next = bookmarks.includes(id) ? bookmarks.filter((item) => item !== id) : [...bookmarks, id];
    persistBookmarks(next);
    toast.success(bookmarks.includes(id) ? "Bookmark removed" : "Saved to bookmarks");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const addToCalendar = async () => {
    const start = new Date(event?.date);
    const end = new Date(event?.endDate || event?.date);
    if (Number.isNaN(start.getTime())) return;
    const pad = (value) => String(value).padStart(2, "0");
    const toStamp = (date) => `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//CampusConnect//Single Event//EN",
      "BEGIN:VEVENT",
      `UID:${event._id}@campusconnect`,
      `DTSTAMP:${toStamp(new Date())}`,
      `DTSTART:${toStamp(start)}`,
      `DTEND:${toStamp(end)}`,
      `SUMMARY:${String(event.title || "Campus Event").replace(/\n/g, " ")}`,
      `DESCRIPTION:${String(event.description || "").replace(/\n/g, " ")}`,
      `LOCATION:${String(event.venue || "").replace(/\n/g, " ")}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ];
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${String(event.title || "event").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Calendar file downloaded");
  };

  const shareEvent = async () => {
    if (!event) return;
    const shareData = { title: event.title, text: `${event.title} — ${event.venue}`, url: window.location.href };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // fallback
      }
    }
    copyLink();
  };

  const bookmarkActive = useMemo(() => bookmarks.includes(id), [bookmarks, id]);
  const myFeedback = useMemo(() => feedback.feedbacks.find((item) => String(item.user?._id) === String(user?._id)), [feedback.feedbacks, user]);

  if (loading || !event) {
    return (
      <div className="content-panel">
        <div className="skeleton-grid">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      </div>
    );
  }

  const isRegistered = Boolean(registration && registration.status !== "cancelled");
  const canRegister = !event.isArchived && !["draft", "completed", "cancelled"].includes(event.status);

  return (
    <div className="content-panel detail-page">
      <section className="detail-hero card-surface">
        <div className="detail-hero-main">
          <span className="hero-badge">Event details</span>
          <h1>{event.title}</h1>
          <p>{event.description}</p>
          <div className="pill-row">
            <span className="badge-pill"><FaCalendarAlt /> {formatDate(event.date)}</span>
            <span className="badge-pill"><FaMapMarkerAlt /> {event.venue}</span>
            <span className="badge-pill"><FaUsers /> {Number.isFinite(event.capacity) && event.capacity !== null ? `${event.capacity} seats` : "Open capacity"}</span>
            <span className="badge-pill">{event.mode || "offline"}</span>
            <span className="badge-pill">{event.certificateEnabled === false ? "No certificate" : "Certificate ready"}</span>
            {event.approvalRequired && <span className="badge-pill subtle">Pending approval</span>}
            {event.status === "draft" && <span className="badge-pill subtle">Draft</span>}
          </div>
          <div className="card-actions wrap">
            <button className="secondary-btn" type="button" onClick={shareEvent}><FaShareAlt /> Share</button>
            <button className="secondary-btn" type="button" onClick={toggleBookmark}>{bookmarkActive ? <FaBookmark /> : <FaRegBookmark />}{bookmarkActive ? "Saved" : "Save"}</button>
            <button className="secondary-btn" type="button" onClick={addToCalendar}><FaCalendarAlt /> Add to calendar</button>
            <button className="secondary-btn" type="button" onClick={() => navigate("/events")}><FaRedo /> Back to events</button>
          </div>
        </div>
        <div className="detail-hero-side">
          <div className="stat-card compact"><strong>{event.views || 0}</strong><span>Views</span></div>
          <div className="stat-card compact"><strong>{event.registrationStats?.confirmed || 0}</strong><span>Confirmed</span></div>
          <div className="stat-card compact"><strong>{event.registrationStats?.waitlisted || 0}</strong><span>Waitlist</span></div>
          <div className="stat-card compact"><strong>{event.featured ? "Yes" : "No"}</strong><span>Featured</span></div>
          <div className="stat-card compact"><strong>{event.status || "upcoming"}</strong><span>Status</span></div>
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="form-card detail-card">
          <div className="section-head compact">
            <div><h2>Full information</h2><p className="muted">Everything you need before you register.</p></div>
          </div>
          <div className="detail-grid">
            <div><p className="detail-label">Organizer</p><p>{event.organizerName || "Campus team"}</p></div>
            <div><p className="detail-label">Speaker</p><p>{event.speakerName || "TBA"}{event.speakerRole ? ` (${event.speakerRole})` : ""}</p></div>
            <div><p className="detail-label">Schedule</p><p>{event.schedule || "Schedule will be announced soon."}</p></div>
            <div><p className="detail-label">Category</p><p>{event.category || "General"} {event.subcategory ? `• ${event.subcategory}` : ""}</p></div>
            <div><p className="detail-label">Mode</p><p>{event.mode || "offline"}</p></div>
            <div><p className="detail-label">Location link</p><p>{event.locationUrl ? <a href={event.locationUrl} target="_blank" rel="noreferrer">Open map</a> : "Not provided"}</p></div>
            <div><p className="detail-label">Rules</p><p>{event.rules || "No rules shared yet."}</p></div>
            <div><p className="detail-label">Attachments</p><p>{listText(event.attachments)}</p></div>
            <div><p className="detail-label">Tags</p><div className="tag-row">{(event.tags || []).length > 0 ? event.tags.map((tag) => <span key={tag} className="mini-tag">{tag}</span>) : <span className="muted">No tags</span>}</div></div>
          </div>
        </section>

        <section className="chart-card detail-card">
          <div className="section-head compact">
            <div><h2>Your ticket & attendance</h2><p className="muted">Status, QR preview, and check-in details.</p></div>
            <div className="section-icon"><FaTicketAlt /></div>
          </div>
          <div className="mini-stats" style={{ marginBottom: 16 }}>
            <div className="mini-card"><FaUsers /><strong>{event.registrationStats?.confirmed || 0}</strong><span>Confirmed</span></div>
            <div className="mini-card"><FaUsers /><strong>{event.registrationStats?.waitlisted || 0}</strong><span>Waitlisted</span></div>
            <div className="mini-card"><FaClock /><strong>{event.registrationStats?.cancelled || 0}</strong><span>Cancelled</span></div>
          </div>
          {isRegistered ? (
            <>
              <div className="mini-stats">
                <div className="mini-card"><FaCheckCircle /><strong>{registration.status}</strong><span>Registration status</span></div>
                <div className="mini-card"><FaClock /><strong>{registration.checkedIn ? "Done" : "Pending"}</strong><span>Check-in</span></div>
              </div>
              <div className="ticket-card">
                <div>
                  <p className="detail-label">Ticket code</p>
                  <h3>{registration.ticketCode || "Waitlisted ticket"}</h3>
                  <p className="muted">{registration.status === "waitlisted" ? `Waitlist position ${registration.waitlistPosition || 0}` : "Bring this to the event desk for attendance check-in."}</p>
                  {registration.certificateCode && <p className="muted">Certificate code: {registration.certificateCode}</p>}
                </div>
                <QrPattern value={registration.ticketCode || `${event._id}-${user?._id || "guest"}`} />
              </div>
            </>
          ) : (
            <div className="empty-state compact-state">
              <p>No active registration yet.</p>
              <button className="primary-btn" type="button" onClick={register} disabled={!canRegister}>Register now</button>
            </div>
          )}
          <div className="card-actions wrap">
            {canRegister && !isRegistered && <button className="primary-btn" type="button" onClick={register}>{registration && registration.status === "cancelled" ? "Re-register" : "Register"}</button>}
            {isRegistered && <button className="secondary-btn" type="button" onClick={cancelRegistration}>Cancel registration</button>}
            {!canRegister && <span className="badge-pill subtle">Registration closed</span>}
          </div>
        </section>
      </div>

      <section className="card-surface" style={{ marginTop: 24 }}>
        <div className="section-head compact">
          <div>
            <h2>Feedback & rating</h2>
            <p className="muted">Share what you thought after attending the event.</p>
          </div>
          <div className="section-icon"><FaStar /></div>
        </div>
        <div className="mini-stats" style={{ marginBottom: 16 }}>
          <div className="mini-card"><strong>{Number(feedback.averageRating || 0).toFixed(1)}</strong><span>Average rating</span></div>
          <div className="mini-card"><strong>{feedback.total || 0}</strong><span>Total reviews</span></div>
          <div className="mini-card"><strong>{myFeedback ? "Yes" : "No"}</strong><span>Your review</span></div>
        </div>
        <div className="field-grid two">
          <select value={feedbackForm.rating} onChange={(e) => setFeedbackForm((prev) => ({ ...prev, rating: Number(e.target.value) }))}>
            {starValues.map((value) => <option key={value} value={value}>{value} star{value > 1 ? "s" : ""}</option>)}
          </select>
          <input value={feedbackForm.comment} onChange={(e) => setFeedbackForm((prev) => ({ ...prev, comment: e.target.value }))} placeholder="Share your thoughts" />
        </div>
        <div className="card-actions wrap" style={{ marginTop: 12 }}>
          <button className="primary-btn" type="button" onClick={submitFeedback} disabled={savingFeedback}>{savingFeedback ? "Saving..." : myFeedback ? "Update feedback" : "Submit feedback"}</button>
        </div>
        <div className="timeline-list" style={{ marginTop: 20 }}>
          {feedback.feedbacks.length === 0 ? <div className="empty-state"><p>No feedback yet. Be the first to review.</p></div> : feedback.feedbacks.slice(0, 6).map((item) => (
            <motion.article key={item._id} className="notification-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="notification-icon"><FaStar /></div>
              <div>
                <h3>{item.user?.name || "Student"} • {item.rating}/5</h3>
                <p>{item.comment || "No comment added."}</p>
                <p className="muted">{formatDate(item.createdAt)} • {item.user?.department || "Campus"}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="card-surface" style={{ marginTop: 24 }}>
        <div className="section-head compact">
          <div><h2>Quick actions</h2><p className="muted">Share, copy, and jump back into the event list.</p></div>
        </div>
        <div className="card-actions wrap">
          <button className="secondary-btn" type="button" onClick={copyLink}><FaShareAlt /> Copy event link</button>
          <Link className="secondary-btn" to="/my-registrations">My registrations</Link>
          <button className="secondary-btn" type="button" onClick={() => navigate("/events")}>Browse more events</button>
        </div>
      </section>
    </div>
  );
}
