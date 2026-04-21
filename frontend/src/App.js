import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import Layout from "./components/Layout";
import Landing from "./Landing";
import Login from "./Login";
import Register from "./Register";
import Home from "./Home";
import Events from "./Events";
import EventDetails from "./EventDetails";
import AdminDashboard from "./AdminDashboard";
import AdminTools from "./AdminTools";
import MyRegistrations from "./MyRegistrations";
import Profile from "./Profile";
import Notifications from "./Notifications";
import Calendar from "./Calendar";
import AdminLogs from "./AdminLogs";
import AdminSystem from "./AdminSystem";
import AdminCheckIn from "./AdminCheckIn";
import Achievements from "./Achievements";
import Wishlist from "./Wishlist";
import Announcements from "./Announcements";
import Volunteer from "./Volunteer";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <Router>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3200,
          style: {
            borderRadius: "18px",
            background: "rgba(15, 23, 42, 0.92)",
            color: "#edf4ff",
            border: "1px solid rgba(148, 163, 184, 0.18)",
            boxShadow: "0 18px 42px rgba(0, 0, 0, 0.22)",
          },
          success: {
            iconTheme: { primary: "#34d399", secondary: "#08111f" },
          },
          error: {
            iconTheme: { primary: "#fb7185", secondary: "#08111f" },
          },
        }}
      />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/home" element={<Layout><Home /></Layout>} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/events" element={<Layout><Events /></Layout>} />
        <Route path="/events/:id" element={<Layout><EventDetails /></Layout>} />
        <Route path="/wishlist" element={<Layout><Wishlist /></Layout>} />
        <Route path="/announcements" element={<Layout><Announcements /></Layout>} />

        <Route path="/my-registrations" element={<ProtectedRoute><Layout><MyRegistrations /></Layout></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />
        <Route path="/volunteer" element={<ProtectedRoute><Layout><Volunteer /></Layout></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Layout><Notifications /></Layout></ProtectedRoute>} />
        <Route path="/calendar" element={<ProtectedRoute><Layout><Calendar /></Layout></ProtectedRoute>} />
        <Route path="/achievements" element={<ProtectedRoute><Layout><Achievements /></Layout></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute adminOnly><Layout><AdminDashboard /></Layout></ProtectedRoute>} />
        <Route path="/admin/tools" element={<ProtectedRoute adminOnly><Layout><AdminTools /></Layout></ProtectedRoute>} />
        <Route path="/admin/logs" element={<ProtectedRoute adminOnly><Layout><AdminLogs /></Layout></ProtectedRoute>} />
        <Route path="/admin/system" element={<ProtectedRoute adminOnly><Layout><AdminSystem /></Layout></ProtectedRoute>} />
        <Route path="/admin/check-in" element={<ProtectedRoute allowedRoles={["admin", "super_admin", "coordinator"]}><Layout><AdminCheckIn /></Layout></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
