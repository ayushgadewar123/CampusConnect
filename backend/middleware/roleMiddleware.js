const Event = require("../models/Event");

const requireRoles = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied" });
  }
  next();
};

const adminOnly = requireRoles("admin", "super_admin");
const coordinatorOrAdmin = requireRoles("coordinator", "admin", "super_admin");

const canManageEvent = async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (["admin", "super_admin"].includes(req.user.role)) return next();
    if (req.user.role !== "coordinator") return res.status(403).json({ message: "Access denied" });

    const eventId = req.params.id || req.params.eventId;
    if (!eventId) return res.status(400).json({ message: "Missing event id" });

    const event = await Event.findById(eventId).select("createdBy coordinatorId");
    if (!event) return res.status(404).json({ message: "Event not found" });

    const ownerId = String(event.createdBy || event.coordinatorId || "");
    if (ownerId !== String(req.user._id)) {
      return res.status(403).json({ message: "Coordinators can only manage their own events" });
    }

    req.managedEvent = event;
    next();
  } catch (error) {
    console.log("EVENT AUTH ERROR:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { requireRoles, adminOnly, coordinatorOrAdmin, canManageEvent };
