import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FaCalendarAlt, FaUsers, FaMapMarkerAlt, FaClock, FaFileExport } from "react-icons/fa";
import api from "./lib/api";

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBA";
  return date.toLocaleString();
}

function monthName(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString(undefined, { month: "long", year: "numeric" });
}

export default function Calendar() {
  const [data, setData] = useState({ events: [], registrations: [] });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/dashboard/calendar");
      setData({
        events: Array.isArray(res.data?.events) ? res.data.events : [],
        registrations: Array.isArray(res.data?.registrations) ? res.data.registrations : [],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const grouped = useMemo(() => {
    const map = new Map();
    data.events.forEach((event) => {
      const key = monthName(event.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(event);
    });
    return Array.from(map.entries());
  }, [data.events]);

  const downloadIcs = () => {
    const pad = (value) => String(value).padStart(2, "0");
    const toUtcStamp = (value) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
    };

    const escapeLine = (value) => String(value || "").replace(/\n/g, " ");

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//CampusConnect//Event Calendar//EN",
      ...data.events.flatMap((event) => {
        const startDate = new Date(event.date);
        if (Number.isNaN(startDate.getTime())) return [];
        const endDate = new Date(event.endDate || event.date);
        return [
          "BEGIN:VEVENT",
          `UID:${event._id}@campusconnect`,
          `DTSTAMP:${toUtcStamp(new Date())}`,
          `DTSTART:${toUtcStamp(startDate)}`,
          `DTEND:${toUtcStamp(endDate)}`,
          `SUMMARY:${escapeLine(event.title || "Campus Event")}`,
          `DESCRIPTION:${escapeLine(event.description)}`,
          `LOCATION:${escapeLine(event.venue)}`,
          "END:VEVENT",
        ];
      }),
      "END:VCALENDAR",
    ];

    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "campusconnect-calendar.ics";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="content-panel">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="hero-badge">Calendar</span>
          <h1>Your event timeline, grouped by month.</h1>
          <p>See upcoming and live activity in one place so you can plan ahead.</p>
        </div>
        <div className="hero-stats">
          <div className="stat-card"><strong>{data.events.length}</strong><span>Events visible</span></div>
          <div className="stat-card"><strong>{data.registrations.length}</strong><span>My registrations</span></div>
          <div className="stat-card"><button className="secondary-btn tiny" type="button" onClick={downloadIcs}><FaFileExport /> Export ICS</button></div>
        </div>
      </section>

      {loading ? <div className="empty-state"><p>Loading calendar...</p></div> : grouped.length === 0 ? (
        <div className="empty-state"><p>No events available for the calendar.</p></div>
      ) : (
        <div className="stack-grid">
          {grouped.map(([month, events]) => (
            <section key={month} className="card-surface">
              <div className="section-head compact">
                <div>
                  <h2>{month}</h2>
                  <p className="muted">{events.length} event{events.length === 1 ? "" : "s"}</p>
                </div>
                <div className="section-icon"><FaCalendarAlt /></div>
              </div>
              <div className="timeline-list calendar-list">
                {events.map((event) => (
                  <motion.article key={event._id} className="timeline-item calendar-item" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                    <div>
                      <strong>{event.title}</strong>
                      <span>{event.category || "General"} • {event.status || "upcoming"}</span>
                    </div>
                    <div className="calendar-meta">
                      <span><FaClock /> {formatDate(event.date)}</span>
                      <span><FaMapMarkerAlt /> {event.venue}</span>
                      <span><FaUsers /> {event.capacity ?? "Open"}</span>
                    </div>
                  </motion.article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
