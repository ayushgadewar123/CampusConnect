import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { FaBookmark, FaShareAlt, FaTrash, FaExternalLinkAlt } from "react-icons/fa";
import api from "./lib/api";
import { useAuth } from "./context/AuthContext";
import AsyncState from "./components/AsyncState";

const storageKey = "campusconnect-bookmarks";

const readLocalBookmarks = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
};

export default function Wishlist() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [localBookmarks, setLocalBookmarks] = useState(readLocalBookmarks);
  const [savedEvents, setSavedEvents] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const persistLocal = (next) => {
    setLocalBookmarks(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (token) {
        const [wishlistRes, eventsRes] = await Promise.all([
          api.get("/api/wishlist"),
          api.get("/api/events", { params: { sort: "soonest", limit: 100 } }).catch(() => ({ data: [] })),
        ]);
        const items = Array.isArray(wishlistRes.data?.wishlist) ? wishlistRes.data.wishlist : [];
        setSavedEvents(items);
        setAllEvents(Array.isArray(eventsRes.data?.events) ? eventsRes.data.events : Array.isArray(eventsRes.data) ? eventsRes.data : []);
        persistLocal(items.map((event) => event._id));
      } else {
        const res = await api.get("/api/events", { params: { sort: "soonest", limit: 100 } });
        const events = Array.isArray(res.data?.events) ? res.data.events : Array.isArray(res.data) ? res.data : [];
        const saved = readLocalBookmarks();
        setAllEvents(events);
        setSavedEvents(events.filter((event) => saved.includes(event._id)));
      }
    } catch (error) {
      const message = error.response?.data?.message || "Could not load wishlist";
      setError(message);
      toast.error(message);
      setSavedEvents([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleBookmark = async (id) => {
    try {
      if (token) {
        const res = await api.post(`/api/wishlist/${id}`);
        const next = Array.isArray(res.data?.wishlist) ? res.data.wishlist.map((item) => String(item)) : [];
        persistLocal(next);
        await fetchData();
        toast.success(res.data?.message || "Wishlist updated");
        return;
      }
      const next = localBookmarks.includes(id) ? localBookmarks.filter((item) => item !== id) : [...localBookmarks, id];
      persistLocal(next);
      setSavedEvents(allEvents.filter((event) => next.includes(event._id)));
      toast.success(localBookmarks.includes(id) ? "Removed from wishlist" : "Added to wishlist");
    } catch (error) {
      toast.error(error.response?.data?.message || "Wishlist update failed");
    }
  };

  const share = async (event) => {
    const url = `${window.location.origin}/events/${event._id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: event.title, text: event.description, url });
        return;
      } catch {
        // fallback
      }
    }
    await navigator.clipboard.writeText(url);
    toast.success("Event link copied");
  };

  const visibleEvents = useMemo(() => savedEvents.filter(Boolean), [savedEvents]);

  return (
    <div className="content-panel">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="hero-badge">Wishlist</span>
          <h1>Saved events that stay with you.</h1>
          <p>Your bookmarks are now persisted in your account when you are signed in, so they follow you across devices.</p>
        </div>
        <div className="hero-stats">
          <div className="stat-card"><strong>{visibleEvents.length}</strong><span>Saved</span></div>
          <div className="stat-card"><strong>{allEvents.length}</strong><span>Total events</span></div>
        </div>
      </section>

      {loading ? (
        <AsyncState variant="loading" title="Loading wishlist" description="Collecting your bookmarked events." />
      ) : error ? (
        <AsyncState variant="error" title="Could not load wishlist" description={error} actionLabel="Try again" onAction={fetchData} />
      ) : visibleEvents.length === 0 ? (
        <AsyncState variant="empty" title="No saved events yet" description="Start bookmarking from the events page." actionLabel="Browse events" onAction={() => navigate("/events")} />
      ) : (
        <div className="event-grid">
          {visibleEvents.map((event) => (
            <motion.article key={event._id} className="event-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <div className="event-top">
                <span className="event-tag"><FaBookmark /> Saved</span>
                <span className={`event-date status-${event.status || "upcoming"}`}>{event.status || "upcoming"}</span>
              </div>
              <h3>{event.title}</h3>
              <p className="clamp-3">{event.description}</p>
              <div className="event-meta">
                <span>📍 {event.venue}</span>
                <span>📅 {new Date(event.date).toLocaleDateString()}</span>
              </div>
              <div className="card-actions">
                <button className="secondary-btn" type="button" onClick={() => navigate(`/events/${event._id}`)}><FaExternalLinkAlt /> Open</button>
                <button className="secondary-btn" type="button" onClick={() => share(event)}><FaShareAlt /> Share</button>
                <button className="secondary-btn" type="button" onClick={() => toggleBookmark(event._id)}><FaTrash /> Remove</button>
              </div>
            </motion.article>
          ))}
        </div>
      )}
    </div>
  );
}
