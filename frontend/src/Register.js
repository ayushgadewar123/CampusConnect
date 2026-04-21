import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { FaCheckCircle, FaEye, FaEyeSlash, FaMedal, FaUserPlus } from "react-icons/fa";
import api from "./lib/api";
import { useAuth } from "./context/AuthContext";

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");
  const [interests, setInterests] = useState("");
  const [skills, setSkills] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const checklist = useMemo(() => [
    "Browse and register for events immediately after sign up",
    "Track achievements, attendance, and registration history",
    "Keep the interface spacious and easy to scan",
  ], []);

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        password: password.trim(),
        department: department.trim(),
        year: year.trim(),
        interests: interests.trim(),
        skills: skills.trim(),
      };
      const res = await api.post("/api/auth/register", payload);
      const payloadEmail = payload.email;
      const nextEmail = res.data?.user?.email || payloadEmail;
      toast.success(res.data?.message || "Account created successfully.");

      if (res.data?.token && res.data?.user) {
        login({ token: res.data.token, refreshToken: res.data.refreshToken, user: res.data.user });
        navigate("/events", { replace: true });
        return;
      }

      navigate("/login", { replace: true, state: { prefillEmail: nextEmail } });
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page auth-shell">
      <motion.aside className="auth-aside card-surface" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="section-head compact">
          <div>
            <span className="hero-badge">Join now</span>
            <h2>Create a student profile that feels real.</h2>
            <p className="muted">You can leave email blank for a safe demo account, and the system will generate one automatically.</p>
          </div>
          <div className="section-icon"><FaUserPlus /></div>
        </div>
        <div className="promo-list">
          {checklist.map((item) => (
            <div key={item} className="promo-item">
              <FaCheckCircle />
              <span>{item}</span>
            </div>
          ))}
        </div>
        <div className="auth-note">
          <FaMedal />
          <span>Each seeded student gets different registrations, achievements, and activity history.</span>
        </div>
        <div className="auth-mini-actions">
          <Link className="secondary-btn full" to="/login">Sign in instead</Link>
          <Link className="secondary-btn full" to="/events">Continue as guest</Link>
        </div>
      </motion.aside>

      <motion.form onSubmit={handleRegister} className="auth-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="auth-header">
          <span className="hero-badge">Create account</span>
          <h1>Register for CampusConnect</h1>
          <p>Students can browse events, register instantly, and track activity without extra steps.</p>
        </div>
        <div className="auth-form">
          <label>
            Full name
            <input type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </label>
          <div className="field-grid two">
            <label>
              Department
              <input type="text" placeholder="Your department" value={department} onChange={(e) => setDepartment(e.target.value)} />
            </label>
            <label>
              Year
              <input type="text" placeholder="Year / Semester" value={year} onChange={(e) => setYear(e.target.value)} />
            </label>
          </div>
          <label>
            Email (optional for demo)
            <input type="text" placeholder="Leave blank for a demo email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>
          <label>
            Password
            <div className="password-field">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <button
                className="password-toggle"
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </label>
          <label>
            Interests
            <input type="text" placeholder="hackathon, sports, workshop" value={interests} onChange={(e) => setInterests(e.target.value)} />
          </label>
          <label>
            Skills
            <input type="text" placeholder="design, coding, communication" value={skills} onChange={(e) => setSkills(e.target.value)} />
          </label>
          <button className="primary-btn full" type="submit" disabled={loading}>{loading ? "Creating account..." : "Register"}</button>
        </div>
        <p className="auth-help auth-help-inline">Already have an account? <Link to="/login">Login</Link></p>
        <p className="auth-help">Demo accounts do not require email verification.</p>
      </motion.form>
    </div>
  );
}

export default Register;
