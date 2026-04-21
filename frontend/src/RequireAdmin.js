import React from "react";
import { Navigate } from "react-router-dom";

export default function RequireAdmin({ children }) {
  const user = JSON.parse(localStorage.getItem("user"));

  if (!user || !["admin", "super_admin"].includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  return children;
}