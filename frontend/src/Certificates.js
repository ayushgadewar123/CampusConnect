import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { FaCertificate, FaDownload, FaCalendarAlt, FaMapMarkerAlt, FaCheckCircle, FaShieldAlt } from "react-icons/fa";
import api from "./lib/api";
import QrPattern from "./components/QrPattern";
import AsyncState from "./components/AsyncState";

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBA";
  return date.toLocaleDateString();
}

export default function Certificates() {
  const [data, setData] = useState({ certificates: [], count: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying, setVerifying] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/api/dashboard/certificates");
      setData({ certificates: Array.isArray(res.data?.certificates) ? res.data.certificates : [], count: res.data?.count || 0 });
    } catch (err) {
      const message = err.response?.data?.message || "Failed to load certificates";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const downloadCertificate = async (cert, format = "svg") => {
    try {
      const res = await api.get(`/api/dashboard/certificates/${cert.id}/download?format=${format}`, { responseType: "blob" });
      const fileExt = format === "txt" ? "txt" : format === "json" ? "json" : format === "pdf" ? "pdf" : "svg";
      const mimeType = format === "txt" ? "text/plain;charset=utf-8" : format === "json" ? "application/json;charset=utf-8" : format === "pdf" ? "application/pdf" : "image/svg+xml;charset=utf-8";
      const blob = new Blob([res.data], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${String(cert.title || "certificate").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-certificate.${fileExt}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Certificate downloaded");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to download certificate");
    }
  };

  return (
    <div className="content-panel">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="hero-badge">Certificates</span>
          <h1>Your completed-event archive.</h1>
          <p>Keep a lasting record of checked-in events and export your proof of participation.</p>
        </div>
        <div className="hero-stats">
          <div className="stat-card"><strong>{data.count}</strong><span>Issued certificates</span></div>
        </div>
      </section>

      <section className="card-surface" style={{ marginTop: 24 }}>
        <div className="section-head compact">
          <div>
            <h2>Verify a certificate</h2>
            <p className="muted">Check whether a certificate code is valid and eligible.</p>
          </div>
          <div className="section-icon"><FaShieldAlt /></div>
        </div>
        <div className="field-grid two">
          <input value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} placeholder="Enter certificate code" />
          <button
            className="primary-btn"
            type="button"
            onClick={async () => {
              try {
                const code = verifyCode.trim();
                if (!code) {
                  toast.error("Enter a certificate code");
                  return;
                }
                setVerifying(true);
                const res = await api.get(`/api/dashboard/certificates/verify/${encodeURIComponent(code)}`);
                setVerifyResult(res.data || null);
                toast.success(res.data?.message || "Certificate checked");
              } catch (err) {
                setVerifyResult(err.response?.data || { verified: false, message: "Certificate not found" });
                toast.error(err.response?.data?.message || "Verification failed");
              } finally {
                setVerifying(false);
              }
            }}
            disabled={verifying}
          >
            <FaShieldAlt /> {verifying ? "Verifying…" : "Verify"}
          </button>
        </div>
        {verifyResult && (
          <div className="notification-card" style={{ marginTop: 16 }}>
            <strong>{verifyResult.verified ? "Verified" : "Not verified"}</strong>
            <p className="muted">{verifyResult.message}</p>
            {verifyResult.event && (
              <p>
                {verifyResult.event.title} • {verifyResult.event.category || "General"} • {verifyResult.event.venue || "TBA"}
              </p>
            )}
            {verifyResult.participant && <p className="muted">Issued to {verifyResult.participant.name}</p>}
          </div>
        )}
      </section>

      {loading ? (
        <AsyncState variant="loading" title="Loading certificates" description="Fetching your verified participation archive." />
      ) : error ? (
        <AsyncState variant="error" title="Could not load certificates" description={error} actionLabel="Retry" onAction={fetchData} />
      ) : data.certificates.length === 0 ? (
        <AsyncState variant="empty" title="No certificates available yet" description="Attend and check in to build your archive." actionLabel="Refresh" onAction={fetchData} />
      ) : (
        <div className="event-grid">
          {data.certificates.map((cert) => (
            <motion.article key={cert.id} className="event-card certificate-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <div className="event-top">
                <span className="event-tag"><FaCertificate /> Certificate</span>
                <span className="event-date status-completed">Issued</span>
              </div>
              <h3>{cert.title}</h3>
              <p>{cert.category || "General"}</p>
              <div className="event-meta">
                <span><FaCalendarAlt /> {formatDate(cert.date)}</span>
                <span><FaMapMarkerAlt /> {cert.venue}</span>
              </div>
              <div className="ticket-snippet">
                <QrPattern value={cert.certificateCode} size={15} />
                <div>
                  <p className="detail-label">Certificate code</p>
                  <strong>{cert.certificateCode}</strong>
                  <p className="muted">{cert.organizerName || "Campus team"}</p>
                </div>
              </div>
              <div className="card-actions wrap">
                <span className="badge-pill"><FaCheckCircle /> Ready</span>
                <button className="secondary-btn" type="button" onClick={() => downloadCertificate(cert, "svg")}><FaDownload /> Download SVG</button>
                <button className="secondary-btn" type="button" onClick={() => downloadCertificate(cert, "pdf")}><FaDownload /> Download PDF</button>
              </div>
            </motion.article>
          ))}
        </div>
      )}
    </div>
  );
}
