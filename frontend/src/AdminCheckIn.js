import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { FaBarcode, FaCheck, FaClipboardCheck, FaClock, FaList, FaSearch, FaUserCheck } from "react-icons/fa";
import api from "./lib/api";
import getSocket from "./lib/socket";

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBA";
  return date.toLocaleString();
}

const statusLabel = {
  confirmed: "Confirmed",
  waitlisted: "Waitlisted",
  cancelled: "Cancelled",
};

export default function AdminCheckIn() {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [summary, setSummary] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [ticketCode, setTicketCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const selectedEvent = useMemo(
    () => events.find((item) => String(item._id) === String(selectedEventId)),
    [events, selectedEventId],
  );

  const fetchRoster = useCallback(async (eventId) => {
    if (!eventId) return;
    try {
      const res = await api.get(`/api/registrations/event/${eventId}/checkins`);
      setRegistrations(Array.isArray(res.data?.registrations) ? res.data.registrations : []);
      setSummary(res.data?.summary || null);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not load check-in roster");
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/events/mine");
      const list = Array.isArray(res.data) ? res.data : [];
      setEvents(list);
      if (list.length) {
        setSelectedEventId((current) => current || String(list[0]._id));
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not load events");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    if (!selectedEventId) return undefined;
    fetchRoster(selectedEventId);
    const socket = getSocket();
    socket.emit("join:event", selectedEventId);
    const refresh = () => fetchRoster(selectedEventId);
    socket.on("registration:update", refresh);
    socket.on("waitlist:update", refresh);
    return () => {
      socket.emit("leave:event", selectedEventId);
      socket.off("registration:update", refresh);
      socket.off("waitlist:update", refresh);
    };
  }, [fetchRoster, selectedEventId]);

  const doCheckIn = async ({ registrationId = "", code = "" } = {}) => {
    if (!selectedEventId) {
      toast.error("Select an event first");
      return;
    }
    const codeValue = (code || ticketCode).trim();
    if (!registrationId && !codeValue) {
      toast.error("Enter a ticket code or choose a participant");
      return;
    }
    try {
      setSubmitting(true);
      await api.post(`/api/registrations/event/${selectedEventId}/checkin`, {
        registrationId,
        ticketCode: codeValue,
      });
      toast.success("Attendance marked");
      setTicketCode("");
      fetchRoster(selectedEventId);
    } catch (error) {
      toast.error(error.response?.data?.message || "Check-in failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="content-panel">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="hero-badge">Check-in desk</span>
          <h1>Quick attendance entry for coordinators.</h1>
          <p>Scan or paste a ticket code, then mark attendance in one click.</p>
        </div>
        <div className="hero-stats">
          <div className="stat-card"><strong>{events.length}</strong><span>Managed events</span></div>
          <div className="stat-card"><strong>{summary?.checkedIn || 0}</strong><span>Checked in</span></div>
          <div className="stat-card"><strong>{summary?.confirmed || 0}</strong><span>Confirmed</span></div>
        </div>
      </section>

      {loading ? (
        <div className="skeleton-grid" style={{ marginTop: 24 }}><div className="skeleton-card" /><div className="skeleton-card" /></div>
      ) : (
        <>
          <section className="card-surface" style={{ marginTop: 24 }}>
            <div className="section-head compact">
              <div>
                <h2>Select event</h2>
                <p className="muted">Switch between events you manage.</p>
              </div>
              <div className="section-icon"><FaList /></div>
            </div>
            <div className="field-grid two">
              <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
                <option value="">Choose an event</option>
                {events.map((event) => (
                  <option key={event._id} value={event._id}>{event.title} • {formatDate(event.date)}</option>
                ))}
              </select>
              <input value={ticketCode} onChange={(e) => setTicketCode(e.target.value)} placeholder="Paste ticket code" />
            </div>
            <div className="card-actions wrap" style={{ marginTop: 16 }}>
              <button className="primary-btn" type="button" onClick={() => doCheckIn()} disabled={submitting || !selectedEventId}>
                <FaBarcode /> {submitting ? "Checking in…" : "Mark by code"}
              </button>
              {selectedEventId && <span className="badge-pill"><FaClock /> {selectedEvent?.status || "upcoming"}</span>}
              {selectedEvent?.capacity != null && <span className="badge-pill"><FaUserCheck /> Capacity {selectedEvent.capacity}</span>}
            </div>
          </section>

          <div className="dashboard-grid" style={{ marginTop: 24 }}>
            <motion.section className="chart-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="section-head compact">
                <div><h2>Roster summary</h2><p className="muted">Attendance snapshot for the selected event.</p></div>
                <div className="section-icon"><FaClipboardCheck /></div>
              </div>
              <div className="dashboard-grid reports-grid">
                <div className="notification-card"><p className="detail-label">Total</p><strong>{summary?.total || 0}</strong></div>
                <div className="notification-card"><p className="detail-label">Confirmed</p><strong>{summary?.confirmed || 0}</strong></div>
                <div className="notification-card"><p className="detail-label">Waitlisted</p><strong>{summary?.waitlisted || 0}</strong></div>
                <div className="notification-card"><p className="detail-label">Checked in</p><strong>{summary?.checkedIn || 0}</strong></div>
              </div>
            </motion.section>

            <motion.section className="chart-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="section-head compact">
                <div><h2>Selected event</h2><p className="muted">Details at a glance.</p></div>
                <div className="section-icon"><FaSearch /></div>
              </div>
              {selectedEvent ? (
                <div className="timeline-list">
                  <div className="timeline-item"><strong>{selectedEvent.title}</strong><span>{selectedEvent.category} • {selectedEvent.venue}</span></div>
                  <div className="timeline-item"><strong>{formatDate(selectedEvent.date)}</strong><span>{selectedEvent.mode} • {selectedEvent.status}</span></div>
                  <div className="timeline-item"><strong>{selectedEvent.capacity ?? "Unlimited"}</strong><span>Capacity</span></div>
                </div>
              ) : (
                <div className="empty-state"><p>Select an event to view roster details.</p></div>
              )}
            </motion.section>
          </div>

          <section className="card-surface" style={{ marginTop: 24 }}>
            <div className="section-head compact">
              <div>
                <h2>Participants</h2>
                <p className="muted">Confirm attendance or review waitlist status.</p>
              </div>
              <div className="section-icon"><FaCheck /></div>
            </div>
            {registrations.length === 0 ? (
              <div className="empty-state"><p>No registrations found for this event.</p></div>
            ) : (
              <div className="table-card">
                {registrations.map((registration) => (
                  <div key={registration._id} className="table-row">
                    <div>
                      <strong>{registration.user?.name || "Participant"}</strong>
                      <p className="muted">{registration.user?.email || ""}</p>
                    </div>
                    <div>
                      <strong>{registration.ticketCode || "No ticket"}</strong>
                      <p className="muted">{registration.certificateCode || "No certificate yet"}</p>
                    </div>
                    <div>
                      <span className={`event-date status-${registration.status || "confirmed"}`}>{statusLabel[registration.status] || registration.status}</span>
                      <p className="muted">{registration.checkedIn ? `Checked in ${formatDate(registration.checkedInAt)}` : "Not checked in"}</p>
                    </div>
                    <button
                      className="secondary-btn tiny"
                      type="button"
                      onClick={() => doCheckIn({ registrationId: registration._id, code: registration.ticketCode })}
                      disabled={submitting || registration.checkedIn || registration.status !== "confirmed"}
                    >
                      {registration.checkedIn ? "Checked in" : "Check in"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
