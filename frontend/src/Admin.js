import React, { useEffect, useMemo, useState } from "react";
import api from "./lib/api";
import { motion } from "framer-motion";
import {
  FaPlus,
  FaTrash,
  FaEdit,
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaClipboardList,
  FaSearch,
} from "react-icons/fa";

export default function Admin() {
  const [events, setEvents] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [venue, setVenue] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const token = localStorage.getItem("token");

  const fetchEvents = async () => {
    try {
      const res = await api.get("/api/events");
      setEvents(res.data);
    } catch (err) {
      setMessage("Failed to load events");
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDate("");
    setVenue("");
    setEditingId(null);
  };

  const handleSubmit = async () => {
    try {
      if (!token) {
        setMessage("Please login first");
        return;
      }

      if (!title || !description || !date || !venue) {
        setMessage("All fields are required");
        return;
      }

      if (editingId) {
        await api.put(`/api/events/${editingId}`, { title, description, date, venue });
        setMessage("Event updated successfully ✅");
      } else {
        await api.post("/api/events", { title, description, date, venue });
        setMessage("Event created successfully ✅");
      }

      resetForm();
      fetchEvents();
    } catch (err) {
      setMessage(err.response?.data?.message || "Something went wrong");
    }
  };

  const handleEdit = (event) => {
    setEditingId(event._id);
    setTitle(event.title);
    setDescription(event.description);
    setDate(event.date ? event.date.slice(0, 10) : "");
    setVenue(event.venue);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/events/${id}`);
      setMessage("Event deleted successfully ✅");
      fetchEvents();
    } catch (err) {
      setMessage(err.response?.data?.message || "Delete failed");
    }
  };

  const stats = useMemo(() => {
    const today = new Date();
    return {
      total: events.length,
      upcoming: events.filter((e) => new Date(e.date) >= today).length,
      past: events.filter((e) => new Date(e.date) < today).length,
    };
  }, [events]);

  const filteredEvents = events.filter((e) => {
    const text = `${e.title} ${e.description} ${e.venue}`.toLowerCase();
    return text.includes(search.toLowerCase());
  });

  return (
    <div className="content-panel">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="hero-badge">Admin control center</span>
          <h1>Manage campus events with a clean, modern dashboard.</h1>
          <p>
            Create, edit, and delete events from a polished workspace designed
            for fast action.
          </p>
        </div>

        <div className="hero-stats">
          <div className="stat-card">
            <strong>{stats.total}</strong>
            <span>Total events</span>
          </div>
          <div className="stat-card">
            <strong>{stats.upcoming}</strong>
            <span>Upcoming</span>
          </div>
          <div className="stat-card">
            <strong>{stats.past}</strong>
            <span>Past</span>
          </div>
        </div>
      </section>

      <motion.section
        className="form-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="section-head">
          <div>
            <h2>{editingId ? "Edit Event" : "Create Event"}</h2>
            <p className="muted">
              {editingId ? "Update the selected event." : "Add a new event to the portal."}
            </p>
          </div>
          <div className="section-icon">
            <FaPlus />
          </div>
        </div>

        <div className="field-grid">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title"
          />
          <input
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            placeholder="Venue"
          />
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Event description"
          rows="5"
        />

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        <div className="button-row">
          <button className="primary-btn full" onClick={handleSubmit} type="button">
            {editingId ? "Update Event" : "Create Event"}
          </button>

          {editingId && (
            <button className="secondary-btn" type="button" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>

        {message && <p className="status-msg">{message}</p>}
      </motion.section>

      <section className="list-head">
        <h2>Manage Events</h2>

        <div className="search-wrap">
          <FaSearch />
          <input
            type="text"
            placeholder="Search events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </section>

      <div className="event-grid admin-event-grid">
        {filteredEvents.length === 0 ? (
          <div className="empty-state">
            <p>No matching events found.</p>
          </div>
        ) : (
          filteredEvents.map((e, index) => (
            <motion.article
              key={e._id}
              className="event-card admin-event-card"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ y: -6 }}
            >
              <div className="event-top">
                <span className="event-tag">Campus Event</span>
                <span className="event-date">
                  {new Date(e.date).toLocaleDateString()}
                </span>
              </div>

              <h3>{e.title}</h3>
              <p>{e.description}</p>

              <div className="event-meta">
                <span>
                  <FaCalendarAlt /> {new Date(e.date).toLocaleDateString()}
                </span>
                <span>
                  <FaMapMarkerAlt /> {e.venue}
                </span>
              </div>

              <div className="card-actions">
                <button className="icon-btn edit" onClick={() => handleEdit(e)}>
                  <FaEdit /> Edit
                </button>
                <button className="icon-btn delete" onClick={() => handleDelete(e._id)}>
                  <FaTrash /> Delete
                </button>
              </div>
            </motion.article>
          ))
        )}
      </div>
    </div>
  );
}