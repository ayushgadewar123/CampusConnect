import { useState } from "react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { FaFileImport, FaBullhorn, FaUpload } from "react-icons/fa";
import api from "./lib/api";

const eventTemplate = `title,description,date,venue,category,subcategory,mode,status,featured,approvalRequired,capacity,waitlistCapacity,organizerName,speakerName,speakerRole,schedule,rules,certificateEnabled,tags,attachments,imageUrl,locationUrl\nHackathon 101,Hands-on build sprint,2026-05-10T09:00:00.000Z,Main Auditorium,Technical,Workshop,offline,published,true,false,100,20,CSE Club,Guest Speaker,Lead Engineer,09:00-17:00,Bring laptop,true,tech|hackathon,poster1.jpg|poster2.jpg,https://...,https://...`;
const userTemplate = `name,email,password,role,department,year,phone,interests,skills\nAarav Sharma,aarav@example.com,pass1234,student,CSE,2,9999999999,tech|design,react|python`;

export default function AdminTools() {
  const [eventImport, setEventImport] = useState(eventTemplate);
  const [userImport, setUserImport] = useState(userTemplate);
  const [announcement, setAnnouncement] = useState({ title: "", message: "", audience: "all" });
  const [busy, setBusy] = useState(false);

  const importData = async (type, content) => {
    try {
      setBusy(true);
      const res = await api.post(`/api/admin/import/${type}`, { content });
      toast.success(res.data?.message || `${type} imported`);
    } catch (error) {
      toast.error(error.response?.data?.message || "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const publishAnnouncement = async () => {
    try {
      setBusy(true);
      await api.post("/api/announcements", announcement);
      toast.success("Announcement published");
      setAnnouncement({ title: "", message: "", audience: "all" });
    } catch (error) {
      toast.error(error.response?.data?.message || "Announcement failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="content-panel">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="hero-badge">Admin tools</span>
          <h1>Bulk import and fast campus messaging.</h1>
          <p>Seed events and users from CSV text, then publish announcements without leaving the app.</p>
        </div>
        <div className="hero-stats">
          <div className="stat-card"><strong>2</strong><span>Importers</span></div>
          <div className="stat-card"><strong>1</strong><span>Publisher</span></div>
        </div>
      </section>

      <div className="dashboard-grid">
        <motion.section className="form-card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
          <div className="section-head compact"><div><h2>Import events</h2><p className="muted">Paste CSV rows to create many events at once.</p></div><div className="section-icon"><FaFileImport /></div></div>
          <textarea rows="10" value={eventImport} onChange={(e) => setEventImport(e.target.value)} />
          <button className="primary-btn" type="button" onClick={() => importData("events", eventImport)} disabled={busy}><FaUpload /> Import events</button>
        </motion.section>

        <motion.section className="form-card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
          <div className="section-head compact"><div><h2>Import users</h2><p className="muted">Seed accounts for coordinators or volunteers.</p></div><div className="section-icon"><FaFileImport /></div></div>
          <textarea rows="10" value={userImport} onChange={(e) => setUserImport(e.target.value)} />
          <button className="primary-btn" type="button" onClick={() => importData("users", userImport)} disabled={busy}><FaUpload /> Import users</button>
        </motion.section>
      </div>

      <section className="card-surface" style={{ marginTop: 24 }}>
        <div className="section-head compact"><div><h2>Publish announcement</h2><p className="muted">A quick campus broadcast.</p></div><div className="section-icon"><FaBullhorn /></div></div>
        <div className="field-grid two">
          <input value={announcement.title} onChange={(e) => setAnnouncement((prev) => ({ ...prev, title: e.target.value }))} placeholder="Announcement title" />
          <select value={announcement.audience} onChange={(e) => setAnnouncement((prev) => ({ ...prev, audience: e.target.value }))}>
            <option value="all">All</option>
            <option value="students">Students</option>
            <option value="coordinators">Coordinators</option>
            <option value="volunteers">Volunteers</option>
            <option value="admins">Admins</option>
          </select>
        </div>
        <textarea rows="5" value={announcement.message} onChange={(e) => setAnnouncement((prev) => ({ ...prev, message: e.target.value }))} placeholder="Announcement message" />
        <button className="primary-btn" type="button" onClick={publishAnnouncement} disabled={busy}>Publish announcement</button>
      </section>
    </div>
  );
}
