import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import {
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaSearch,
  FaStar,
  FaRedo,
  FaFilter,
  FaShareAlt,
  FaBookmark,
  FaRegBookmark,
  FaEye,
  FaUsers,
  FaTag,
  FaThLarge,
  FaExternalLinkAlt,
  FaChevronLeft,
  FaChevronRight,
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

const defaultCategories = ["General", "Technical", "Cultural", "Sports", "Workshop", "Hackathon", "Seminar", "Placement"];
const statusOptions = ["All", "draft", "published", "upcoming", "live", "completed", "cancelled"];
const modeOptions = ["offline", "online", "hybrid"];
const pageSize = 8;

export default function Events() {
  const [events, setEvents] = useState([]);
  const [registeredIds, setRegisteredIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedMode, setSelectedMode] = useState("All");
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [sortBy, setSortBy] = useState("soonest");
  const [bookmarks, setBookmarks] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);

  const { user, token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("campusconnect-bookmarks") || "[]");
    setBookmarks(Array.isArray(saved) ? saved : []);
  }, []);

  useEffect(() => {
    if (!token) return;
    api
      .get("/api/wishlist")
      .then((res) => {
        const ids = Array.isArray(res.data?.wishlist)
          ? res.data.wishlist.map((item) => String(item._id || item))
          : [];
        setBookmarks(ids);
        localStorage.setItem("campusconnect-bookmarks", JSON.stringify(ids));
      })
      .catch(() => {});
  }, [token]);

  const persistBookmarks = (next) => {
    setBookmarks(next);
    localStorage.setItem("campusconnect-bookmarks", JSON.stringify(next));
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        search: search || undefined,
        status: selectedStatus === "All" ? undefined : selectedStatus,
        category: selectedCategory === "All" ? undefined : selectedCategory,
        mode: selectedMode === "All" ? undefined : selectedMode,
        tag: selectedTag || undefined,
        dateFrom: selectedDate || undefined,
        dateTo: selectedDate || undefined,
        sort: sortBy || undefined,
      };

      const [eventsRes, registrationsRes, recRes] = await Promise.all([
        api.get("/api/events", { params }),
        token ? api.get("/api/registrations/my") : Promise.resolve({ data: [] }),
        api.get("/api/events/recommendations").catch(() => ({ data: { recommendations: [] } })),
      ]);

      setEvents(Array.isArray(eventsRes.data) ? eventsRes.data : []);
      setRegisteredIds(
        Array.isArray(registrationsRes.data)
          ? registrationsRes.data.map((item) => item?.event?._id || item?.event).filter(Boolean)
          : []
      );
      setRecommendations(Array.isArray(recRes.data?.recommendations) ? recRes.data.recommendations : []);
      setCurrentPage(1);
    } catch (err) {
      setError(err.response?.data?.message || "Backend unavailable. Please retry.");
    } finally {
      setLoading(false);
    }
  }, [selectedDate, search, selectedCategory, selectedMode, selectedStatus, selectedTag, sortBy, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(events.map((event) => event.category || "General")));
    const ordered = [...defaultCategories, ...unique].filter(Boolean);
    return ["All", ...Array.from(new Set(ordered))];
  }, [events]);

  const allTags = useMemo(() => {
    const tagSet = new Set();
    events.forEach((event) => safeArray(event.tags).forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [events]);

  const stats = useMemo(
    () => ({
      featured: events.filter((event) => event.featured).length,
      live: events.filter((event) => event.status === "live").length,
      regCount: registeredIds.length,
    }),
    [events, registeredIds]
  );

  const recommendedEvents = useMemo(() => {
    if (recommendations.length > 0) return recommendations;
    const interestSet = new Set((user?.interests || []).map((item) => String(item).toLowerCase()));
    return events
      .filter((event) => {
        const eventTags = [event.category, event.subcategory, ...(Array.isArray(event.tags) ? event.tags : [])].map((item) =>
          String(item || "").toLowerCase()
        );
        return eventTags.some((tag) => interestSet.has(tag));
      })
      .slice(0, 4);
  }, [events, user, recommendations]);

  const visibleEvents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return events.slice(start, start + pageSize);
  }, [events, currentPage]);

  const totalPages = Math.max(1, Math.ceil(events.length / pageSize));
  const pageStart = events.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(events.length, currentPage * pageSize);

  const pageNumbers = useMemo(() => {
    const range = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    for (let page = start; page <= end; page += 1) range.push(page);
    return range;
  }, [currentPage, totalPages]);

  const register = async (eventId) => {
    if (!user) {
      toast.error("Please login first");
      navigate("/login");
      return;
    }
    try {
      await api.post(`/api/registrations/${eventId}`);
      toast.success("Registration saved");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed");
    }
  };

  const toggleBookmark = async (eventId) => {
    if (token) {
      try {
        const res = await api.post(`/api/wishlist/${eventId}`);
        const next = Array.isArray(res.data?.wishlist) ? res.data.wishlist.map((item) => String(item)) : [];
        setBookmarks(next);
        localStorage.setItem("campusconnect-bookmarks", JSON.stringify(next));
        toast.success(res.data?.message || (bookmarks.includes(eventId) ? "Removed from wishlist" : "Added to wishlist"));
        return;
      } catch (error) {
        toast.error(error.response?.data?.message || "Wishlist update failed");
        return;
      }
    }

    const next = bookmarks.includes(eventId) ? bookmarks.filter((id) => id !== eventId) : [...bookmarks, eventId];
    persistBookmarks(next);
  };

  const clearFilters = () => {
    setSearch("");
    setSelectedCategory("All");
    setSelectedStatus("All");
    setSelectedMode("All");
    setSelectedTag("");
    setSelectedDate("");
    setSortBy("soonest");
  };

  const copyLink = async (event) => {
    const link = `${window.location.origin}/events/${event._id}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Event link copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const shareEvent = async (event) => {
    const url = `${window.location.origin}/events/${event._id}`;
    const text = `${event.title} — ${event.venue}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: event.title, text, url });
        return;
      } catch {
        // fall back to copy
      }
    }
    copyLink(event);
  };

  const openEvent = (event) => navigate(`/events/${event._id}`);

  const jumpToPage = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="content-panel events-page">
      <section className="hero-card events-hero">
        <div className="hero-copy">
          <span className="hero-badge">Event explorer</span>
          <h1>Find campus opportunities in a calmer, richer layout.</h1>
          <p>One clean date filter, strong visual hierarchy, and cards that feel designed instead of squeezed in.</p>
        </div>
        <div className="hero-stats">
          <div className="stat-card"><strong>{events.length}</strong><span>Visible events</span></div>
          <div className="stat-card"><strong>{stats.regCount}</strong><span>Registered</span></div>
          <div className="stat-card"><strong>{stats.featured}</strong><span>Featured</span></div>
        </div>
      </section>

      <section className="toolbar card-surface">
        <div className="results-bar compact-results">
          <div>
            <strong>{events.length}</strong>
            <p className="muted">Matching events after filters</p>
          </div>
          <div className="results-actions">
            <span className="badge-pill subtle">Search + filter</span>
            <span className="badge-pill subtle">Share + register</span>
          </div>
        </div>
        <div className="search-wrap grow">
          <FaSearch />
          <input
            type="text"
            placeholder="Search title, venue, category, tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filters-stack">
          <div className="filter-grid compact-grid">
            <div className="filter-block">
              <span className="filter-label">Sort</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="chip-select">
                <option value="soonest">Soonest</option>
                <option value="latest">Newest</option>
                <option value="popular">Most viewed</option>
                <option value="capacity">Lowest capacity</option>
              </select>
            </div>
            <div className="filter-block">
              <span className="filter-label">Date</span>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
            </div>
            <div className="filter-block">
              <span className="filter-label">Tags</span>
              <select value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)}>
                <option value="">All tags</option>
                {allTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
              </select>
            </div>
          </div>

          <div className="filter-block">
            <span className="filter-label"><FaFilter className="muted-icon" /> Quick view</span>
            <div className="filter-row wrap">
              <button type="button" className={"filter-chip " + (selectedStatus === "All" && !selectedTag && !selectedDate && !search ? "active" : "")} onClick={clearFilters}>
                All
              </button>
              <button type="button" className={"filter-chip " + (selectedStatus === "upcoming" ? "active" : "")} onClick={() => setSelectedStatus("upcoming")}>
                Upcoming
              </button>
              <button type="button" className={"filter-chip " + (selectedStatus === "live" ? "active" : "")} onClick={() => setSelectedStatus("live")}>
                Live
              </button>
              <button type="button" className={"filter-chip " + (selectedCategory === "Workshop" ? "active" : "")} onClick={() => setSelectedCategory("Workshop")}>
                Workshop
              </button>
              <button type="button" className={"filter-chip " + (selectedCategory === "Hackathon" ? "active" : "")} onClick={() => setSelectedCategory("Hackathon")}>
                Hackathon
              </button>
            </div>
          </div>

          <div className="filter-block">
            <span className="filter-label"><FaFilter className="muted-icon" /> Category</span>
            <div className="filter-row wrap">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={"filter-chip " + (selectedCategory === category ? "active" : "")}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-block">
            <span className="filter-label">Status</span>
            <div className="filter-row wrap">
              {statusOptions.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={"filter-chip " + (selectedStatus === status ? "active" : "")}
                  onClick={() => setSelectedStatus(status)}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-block">
            <span className="filter-label">Mode</span>
            <div className="filter-row wrap">
              <button type="button" className={"filter-chip " + (selectedMode === "All" ? "active" : "")} onClick={() => setSelectedMode("All")}>
                Any mode
              </button>
              {modeOptions.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={"filter-chip " + (selectedMode === mode ? "active" : "")}
                  onClick={() => setSelectedMode(mode)}
                >
                  {mode}
                </button>
              ))}
              <button type="button" className="secondary-btn tiny" onClick={clearFilters}>
                <FaRedo /> Reset
              </button>
            </div>
          </div>
        </div>
      </section>

      {recommendedEvents.length > 0 && (
        <section className="recommend-strip card-surface">
          <div className="section-head compact">
            <div>
              <h2>Recommended for you</h2>
              <p className="muted">Scored from your interests, activity, and popularity.</p>
            </div>
            <div className="section-icon"><FaThLarge /></div>
          </div>
          <div className="recommend-grid">
            {recommendedEvents.map((event) => (
              <button key={event._id} type="button" className="recommend-pill" onClick={() => openEvent(event)}>
                <FaStar /> {event.title}
                {event.reasons?.length ? <span className="recommend-meta">{event.reasons[0]}</span> : null}
              </button>
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <div className="skeleton-grid">
          {Array.from({ length: 8 }).map((_, index) => <div key={index} className="skeleton-card" />)}
        </div>
      ) : error ? (
        <div className="empty-state error-state">
          <p>{error}</p>
          <button className="primary-btn" type="button" onClick={fetchData}>Retry</button>
        </div>
      ) : events.length === 0 ? (
        <div className="empty-state">
          <p>No events matched your filters.</p>
          <button className="secondary-btn" type="button" onClick={clearFilters}>Clear filters</button>
        </div>
      ) : (
        <>
          <div className="results-bar card-surface">
            <div>
              <strong>{pageStart}-{pageEnd}</strong>
              <p className="muted">Showing {pageEnd - pageStart + 1} of {events.length} events</p>
            </div>
            <div className="results-actions">
              <span className="badge-pill subtle"><FaEye /> {stats.live} live</span>
              <span className="badge-pill subtle"><FaUsers /> {stats.regCount} registered</span>
            </div>
          </div>

          <div className="event-grid">
            {visibleEvents.map((event, index) => {
              const alreadyRegistered = registeredIds.includes(event._id);
              const registrationClosed = ["draft", "completed", "cancelled"].includes(event.status);
              const isDisabled = alreadyRegistered || registrationClosed;
              const registeredCount = Number(event.registeredCount ?? event.registrationCount ?? 0);
              const capacity = Number(event.capacity ?? 0);
              const progress = capacity > 0 ? Math.min(100, (registeredCount / capacity) * 100) : 0;

              return (
                <motion.article
                  key={event._id}
                  className="event-card"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <div className="event-top">
                    <span className="event-tag"><FaStar /> {event.featured ? "Featured" : event.category || "General"}</span>
                    <span className={`event-date status-${event.status || "upcoming"}`}>{(event.status || "upcoming").toUpperCase()}</span>
                  </div>

                  <h3>{event.title}</h3>
                  <p className="clamp-3">{event.description}</p>

                  <div className="event-meta">
                    <span><FaCalendarAlt /> {formatDate(event.date)}</span>
                    <span><FaMapMarkerAlt /> {event.venue || "Campus"}</span>
                  </div>

                  <div className="meta-row">
                    <span className="badge-pill">{event.mode || "offline"}</span>
                    <span className="badge-pill subtle"><FaEye /> {event.views || 0}</span>
                    <span className="badge-pill subtle"><FaUsers /> {capacity > 0 ? `${registeredCount}/${capacity}` : "Open"}</span>
                  </div>

                  <div className="progress-shell" aria-hidden="true">
                    <span className="progress-bar" style={{ width: `${progress || 18}%` }} />
                  </div>

                  {safeArray(event.tags).length > 0 && (
                    <div className="tag-row">
                      {safeArray(event.tags).slice(0, 3).map((tag) => (
                        <span key={tag} className="mini-tag"><FaTag /> {tag}</span>
                      ))}
                    </div>
                  )}

                  <div className="card-actions">
                    <button className="secondary-btn" type="button" onClick={() => openEvent(event)}>
                      View details <FaExternalLinkAlt />
                    </button>
                    <button className="secondary-btn" type="button" onClick={() => shareEvent(event)}>
                      <FaShareAlt /> Share
                    </button>
                    <button className="icon-btn" type="button" onClick={() => toggleBookmark(event._id)} aria-label="Bookmark">
                      {bookmarks.includes(event._id) ? <FaBookmark /> : <FaRegBookmark />}
                    </button>
                  </div>

                  <button className="primary-btn" onClick={() => register(event._id)} type="button" disabled={isDisabled}>
                    {alreadyRegistered
                      ? "Already Registered"
                      : registrationClosed
                        ? "Registration Closed"
                        : "Register Now"}
                  </button>
                </motion.article>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="pagination-bar card-surface">
              <button className="secondary-btn tiny" type="button" onClick={() => jumpToPage(currentPage - 1)} disabled={currentPage === 1}>
                <FaChevronLeft /> Prev
              </button>

              <div className="page-chips">
                {pageNumbers[0] > 1 && (
                  <>
                    <button type="button" className={`page-chip ${currentPage === 1 ? "active" : ""}`} onClick={() => jumpToPage(1)}>1</button>
                    {pageNumbers[0] > 2 && <span className="page-gap">…</span>}
                  </>
                )}

                {pageNumbers.map((page) => (
                  <button key={page} type="button" className={`page-chip ${currentPage === page ? "active" : ""}`} onClick={() => jumpToPage(page)}>
                    {page}
                  </button>
                ))}

                {pageNumbers[pageNumbers.length - 1] < totalPages && (
                  <>
                    {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && <span className="page-gap">…</span>}
                    <button type="button" className={`page-chip ${currentPage === totalPages ? "active" : ""}`} onClick={() => jumpToPage(totalPages)}>
                      {totalPages}
                    </button>
                  </>
                )}
              </div>

              <button className="secondary-btn tiny" type="button" onClick={() => jumpToPage(currentPage + 1)} disabled={currentPage === totalPages}>
                Next <FaChevronRight />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
