import axios from "axios";
import {
  demoAnnouncements,
  demoEvents,
  demoRegistrations,
  demoWishlistIds,
  findDemoEvent,
  getDemoEventRecommendations,
} from "./demoContent";

const normalizeBackendUrl = (value) => {
  const raw = String(value || "").trim().replace(/\/$/, "");
  if (!raw) return "";
  return raw.replace(/\/api$/i, "");
};

const resolveDefaultBaseUrl = () => {
  if (typeof process !== "undefined" && process.env?.REACT_APP_API_URL) {
    return normalizeBackendUrl(process.env.REACT_APP_API_URL);
  }

  if (typeof window === "undefined") {
    return "http://localhost:5000";
  }

  return "";
};

const API_BASE_URL = resolveDefaultBaseUrl();
const SOCKET_URL =
  (typeof process !== "undefined" && process.env?.REACT_APP_SOCKET_URL)
    ? normalizeBackendUrl(process.env.REACT_APP_SOCKET_URL)
    : API_BASE_URL || "http://localhost:5000";
const OFFLINE_PREFIXES = ["/api/events", "/api/announcements", "/api/registrations", "/api/wishlist", "/api/dashboard", "/api/notifications", "/api/settings", "/api/volunteers", "/api/system", "/api/admin"];

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 20000,
});

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 20000,
});

const safeParse = (value, fallback = null) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const readCache = (key, fallback) => safeParse(localStorage.getItem(key), fallback);
const writeCache = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
};

const getRequestPath = (config = {}) => {
  const rawUrl = String(config.url || "");
  const params = config.params || {};
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });

  const url = rawUrl.startsWith("http") ? rawUrl : `http://local${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
  const parsed = new URL(url);
  const merged = new URLSearchParams(parsed.search);
  query.forEach((value, key) => merged.set(key, value));
  return { path: parsed.pathname, params: merged };
};

const sortEvents = (events, params) => {
  const sort = String(params.get("sort") || "soonest").toLowerCase();
  const next = [...events];

  if (sort === "latest") next.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  else if (sort === "popular") next.sort((a, b) => Number(b.views || 0) - Number(a.views || 0));
  else if (sort === "capacity") next.sort((a, b) => Number(a.capacity || 0) - Number(b.capacity || 0));
  else next.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

  return next;
};

const filterEvents = (events, params) => {
  const search = String(params.get("search") || "").trim().toLowerCase();
  const status = String(params.get("status") || "").trim().toLowerCase();
  const category = String(params.get("category") || "").trim().toLowerCase();
  const mode = String(params.get("mode") || "").trim().toLowerCase();
  const tag = String(params.get("tag") || "").trim().toLowerCase();
  const dateFrom = String(params.get("dateFrom") || "").trim();
  const dateTo = String(params.get("dateTo") || "").trim();
  const minCapacity = Number(params.get("minCapacity") || 0);
  const maxCapacity = Number(params.get("maxCapacity") || 0);

  let next = [...events];
  if (search) {
    next = next.filter((event) => {
      const haystack = [event.title, event.description, event.venue, event.category, event.subcategory, ...(Array.isArray(event.tags) ? event.tags : [])]
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }
  if (status) next = next.filter((event) => String(event.status || "").toLowerCase() === status);
  if (category) next = next.filter((event) => String(event.category || "").toLowerCase() === category);
  if (mode) next = next.filter((event) => String(event.mode || "").toLowerCase() === mode);
  if (tag) next = next.filter((event) => (Array.isArray(event.tags) ? event.tags : []).some((item) => String(item).toLowerCase() === tag));
  if (dateFrom) next = next.filter((event) => new Date(event.date || 0) >= new Date(dateFrom));
  if (dateTo) next = next.filter((event) => new Date(event.date || 0) <= new Date(dateTo));
  if (minCapacity) next = next.filter((event) => Number(event.capacity || 0) >= minCapacity);
  if (maxCapacity) next = next.filter((event) => Number(event.capacity || 0) <= maxCapacity);

  return next;
};

const getUserRef = () => safeParse(localStorage.getItem("user"), null);

const buildOfflineResponse = (config) => {
  const method = String(config.method || "get").toLowerCase();
  const { path, params } = getRequestPath(config);
  const body = config.data ? safeParse(config.data, config.data) : {};


  if (path === "/api/events/pending") {
    return { data: [], status: 200, statusText: "OK", headers: {}, config, request: null };
  }

  if (path.startsWith("/api/events")) {
    if (path === "/api/events") {
      const cached = readCache("campusconnect-cache-events", demoEvents);
      const data = sortEvents(filterEvents(Array.isArray(cached) ? cached : demoEvents, params), params);
      return { data, status: 200, statusText: "OK", headers: {}, config, request: null };
    }
    if (path === "/api/events/recommendations") {
      const recommendations = readCache("campusconnect-cache-event-recommendations", getDemoEventRecommendations());
      return { data: { recommendations }, status: 200, statusText: "OK", headers: {}, config, request: null };
    }
    if (path === "/api/events/stats/summary") {
      const events = readCache("campusconnect-cache-events", demoEvents);
      return {
        data: {
          totalEvents: events.length,
          featuredEvents: events.filter((event) => event.featured).length,
          upcomingEvents: events.filter((event) => ["upcoming", "published", "live"].includes(String(event.status || "").toLowerCase())).length,
          liveEvents: events.filter((event) => String(event.status || "").toLowerCase() === "live").length,
          archivedEvents: 0,
          draftEvents: events.filter((event) => String(event.status || "").toLowerCase() === "draft").length,
        },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
        request: null,
      };
    }
    const id = path.split("/").pop();
    const event = findDemoEvent(id);
    if (event) return { data: event, status: 200, statusText: "OK", headers: {}, config, request: null };
    return { data: demoEvents, status: 200, statusText: "OK", headers: {}, config, request: null };
  }

  if (path === "/api/announcements") {
    const announcements = readCache("campusconnect-cache-announcements", demoAnnouncements);
    return { data: Array.isArray(announcements) ? announcements : demoAnnouncements, status: 200, statusText: "OK", headers: {}, config, request: null };
  }

  if (path === "/api/registrations/my") {
    return { data: readCache("campusconnect-cache-registrations", demoRegistrations), status: 200, statusText: "OK", headers: {}, config, request: null };
  }

  if (path.startsWith("/api/wishlist")) {
    return { data: { wishlist: readCache("campusconnect-cache-wishlist", demoWishlistIds) }, status: 200, statusText: "OK", headers: {}, config, request: null };
  }

  if (path.startsWith("/api/dashboard/calendar")) {
    return { data: { events: readCache("campusconnect-cache-events", demoEvents), registrations: readCache("campusconnect-cache-registrations", demoRegistrations) }, status: 200, statusText: "OK", headers: {}, config, request: null };
  }

  if (path.startsWith("/api/dashboard/certificates")) {
    return { data: { certificates: [], stats: { total: 0, verified: 0, pending: 0 } }, status: 200, statusText: "OK", headers: {}, config, request: null };
  }

  if (path.startsWith("/api/dashboard/achievements")) {
    return { data: { achievements: [], stats: { registeredEvents: 0, checkedInEvents: 0, completedEvents: 0 } }, status: 200, statusText: "OK", headers: {}, config, request: null };
  }

  if (path.startsWith("/api/dashboard/leaderboard")) {
    return { data: { leaderboard: [] }, status: 200, statusText: "OK", headers: {}, config, request: null };
  }

  if (path.startsWith("/api/notifications")) {
    return { data: [], status: 200, statusText: "OK", headers: {}, config, request: null };
  }

  if (path.startsWith("/api/settings/notifications")) {
    return { data: { preferences: { email: true, push: true, reminders: true } }, status: 200, statusText: "OK", headers: {}, config, request: null };
  }

  if (path.startsWith("/api/volunteers/me")) {
    return { data: { assignments: [] }, status: 200, statusText: "OK", headers: {}, config, request: null };
  }

  if (path.startsWith("/api/system/overview")) {
    return { data: { uptimeSeconds: 0, queue: 0, maintenanceMode: false }, status: 200, statusText: "OK", headers: {}, config, request: null };
  }

  if (path.startsWith("/api/system/history")) {
    return { data: { history: [] }, status: 200, statusText: "OK", headers: {}, config, request: null };
  }

  if (path.startsWith("/api/system/queue")) {
    return { data: { jobs: [] }, status: 200, statusText: "OK", headers: {}, config, request: null };
  }

  if (path.startsWith("/api/admin/dashboard")) {
    return { data: { stats: {}, recentActivity: [], pendingEvents: [] }, status: 200, statusText: "OK", headers: {}, config, request: null };
  }

  if (path.startsWith("/api/admin/users")) {
    return { data: { users: [] }, status: 200, statusText: "OK", headers: {}, config, request: null };
  }

  if (path.startsWith("/api/admin/reports")) {
    return { data: { reports: [] }, status: 200, statusText: "OK", headers: {}, config, request: null };
  }

  if (path.startsWith("/api/admin/logs")) {
    return { data: { logs: [] }, status: 200, statusText: "OK", headers: {}, config, request: null };
  }

  if (path.startsWith("/api/admin/analytics")) {
    return { data: { analytics: {} }, status: 200, statusText: "OK", headers: {}, config, request: null };
  }


  if (path === "/api/protected") {
    return { data: { message: "Protected route 🔒", user: getUserRef() }, status: 200, statusText: "OK", headers: {}, config, request: null };
  }

  if (path === "/api/auth/me") {
    return { data: { user: getUserRef() }, status: 200, statusText: "OK", headers: {}, config, request: null };
  }

  if (path === "/api/dashboard") {
    return {
      data: {
        stats: {
          totalEvents: readCache("campusconnect-cache-events", demoEvents).length,
          registrations: readCache("campusconnect-cache-registrations", demoRegistrations).length,
          announcements: readCache("campusconnect-cache-announcements", demoAnnouncements).length,
        },
        recentEvents: readCache("campusconnect-cache-events", demoEvents).slice(0, 5),
        recentAnnouncements: readCache("campusconnect-cache-announcements", demoAnnouncements).slice(0, 5),
      },
      status: 200,
      statusText: "OK",
      headers: {},
      config,
      request: null,
    };
  }

  if (path.match(/^\/api\/feedback\/[^/]+$/)) {
    return { data: { averageRating: 0, total: 0, feedbacks: [] }, status: 200, statusText: "OK", headers: {}, config, request: null };
  }

  // Lightweight offline write support for the main demo flows.
  if (method === "post" && path === "/api/announcements") {
    const announcements = readCache("campusconnect-cache-announcements", demoAnnouncements);
    const next = [{
      _id: `offline-announcement-${Date.now()}`,
      title: String(body.title || "").trim(),
      message: String(body.message || "").trim(),
      audience: String(body.audience || "all"),
      event: body.event || null,
      isPinned: Boolean(body.isPinned),
      expiresAt: body.expiresAt || null,
      createdAt: new Date().toISOString(),
      createdBy: getUserRef() || { name: "Campus team" },
    }, ...announcements].slice(0, 30);
    writeCache("campusconnect-cache-announcements", next);
    return { data: { message: "Announcement published", announcement: next[0], sent: 0 }, status: 201, statusText: "Created", headers: {}, config, request: null };
  }

  if (method === "patch" && path.match(/^\/api\/announcements\/[^/]+\/pin$/)) {
    const id = path.split("/").slice(-2, -1)[0];
    const announcements = readCache("campusconnect-cache-announcements", demoAnnouncements);
    const next = announcements.map((item) => String(item._id) === String(id) ? { ...item, isPinned: !item.isPinned } : item);
    writeCache("campusconnect-cache-announcements", next);
    return { data: { message: "Announcement updated", announcement: next.find((item) => String(item._id) === String(id)) || null }, status: 200, statusText: "OK", headers: {}, config, request: null };
  }

  if (method === "delete" && path.match(/^\/api\/announcements\/[^/]+$/)) {
    const id = path.split("/").pop();
    const announcements = readCache("campusconnect-cache-announcements", demoAnnouncements);
    const next = announcements.filter((item) => String(item._id) !== String(id));
    writeCache("campusconnect-cache-announcements", next);
    return { data: { message: "Announcement archived" }, status: 200, statusText: "OK", headers: {}, config, request: null };
  }

  if (method === "post" && path === "/api/events") {
    const events = readCache("campusconnect-cache-events", demoEvents);
    const nextEvent = {
      _id: `offline-event-${Date.now()}`,
      title: String(body.title || "").trim(),
      description: String(body.description || "").trim(),
      date: body.date || null,
      endDate: body.endDate || body.date || null,
      venue: String(body.venue || "").trim(),
      category: String(body.category || "General"),
      mode: String(body.mode || "offline"),
      status: String(body.status || "upcoming"),
      featured: Boolean(body.featured),
      capacity: Number(body.capacity || 0),
      waitlistCapacity: Number(body.waitlistCapacity || 0),
      organizerName: String(body.organizerName || ""),
      tags: Array.isArray(body.tags) ? body.tags : String(body.tags || "").split(",").map((item) => item.trim()).filter(Boolean),
      views: 0,
      registeredCount: 0,
      createdAt: new Date().toISOString(),
    };
    const next = [nextEvent, ...events].slice(0, 100);
    writeCache("campusconnect-cache-events", next);
    return { data: { message: "Event created successfully", event: nextEvent }, status: 201, statusText: "Created", headers: {}, config, request: null };
  }

  if (method === "put" && path.match(/^\/api\/events\/[^/]+$/)) {
    const id = path.split("/").pop();
    const events = readCache("campusconnect-cache-events", demoEvents);
    const next = events.map((item) => String(item._id) === String(id) ? { ...item, ...body } : item);
    writeCache("campusconnect-cache-events", next);
    return { data: { message: "Event updated successfully", event: next.find((item) => String(item._id) === String(id)) || null }, status: 200, statusText: "OK", headers: {}, config, request: null };
  }

  if (method === "delete" && path.match(/^\/api\/events\/[^/]+$/)) {
    const id = path.split("/").pop();
    const events = readCache("campusconnect-cache-events", demoEvents);
    const next = events.filter((item) => String(item._id) !== String(id));
    writeCache("campusconnect-cache-events", next);
    return { data: { message: "Event deleted successfully" }, status: 200, statusText: "OK", headers: {}, config, request: null };
  }

  if (method === "post" && path.match(/^\/api\/registrations\/[^/]+$/)) {
    const id = path.split("/").pop();
    const events = readCache("campusconnect-cache-events", demoEvents);
    const event = events.find((item) => String(item._id) === String(id)) || null;
    const registrations = readCache("campusconnect-cache-registrations", demoRegistrations);
    const registration = { _id: `offline-registration-${Date.now()}`, event: event || id, status: "registered", checkedIn: false, createdAt: new Date().toISOString() };
    const next = [registration, ...registrations].slice(0, 100);
    writeCache("campusconnect-cache-registrations", next);
    return { data: { message: "Registration saved", registration }, status: 200, statusText: "OK", headers: {}, config, request: null };
  }

  if (method === "delete" && path.match(/^\/api\/registrations\/[^/]+$/)) {
    const id = path.split("/").pop();
    const registrations = readCache("campusconnect-cache-registrations", demoRegistrations);
    const next = registrations.filter((item) => String(item.event?._id || item.event) !== String(id));
    writeCache("campusconnect-cache-registrations", next);
    return { data: { message: "Registration cancelled" }, status: 200, statusText: "OK", headers: {}, config, request: null };
  }

  if (method === "post" && path.match(/^\/api\/wishlist\/[^/]+$/)) {
    const id = path.split("/").pop();
    const wishlist = readCache("campusconnect-cache-wishlist", demoWishlistIds);
    const next = wishlist.includes(id) ? wishlist.filter((item) => item !== id) : [...wishlist, id];
    writeCache("campusconnect-cache-wishlist", next);
    return { data: { message: wishlist.includes(id) ? "Removed from wishlist" : "Added to wishlist", wishlist: next }, status: 200, statusText: "OK", headers: {}, config, request: null };
  }

  return null;
};

const syncCacheFromResponse = (config, data) => {
  const { path } = getRequestPath(config);
  if (path === "/api/events" && Array.isArray(data)) writeCache("campusconnect-cache-events", data);
  if (path === "/api/announcements" && Array.isArray(data)) writeCache("campusconnect-cache-announcements", data);
  if (path === "/api/registrations/my" && Array.isArray(data)) writeCache("campusconnect-cache-registrations", data);
  if (path.startsWith("/api/wishlist") && data?.wishlist) writeCache("campusconnect-cache-wishlist", data.wishlist);
  if (path === "/api/events/recommendations" && Array.isArray(data?.recommendations)) writeCache("campusconnect-cache-event-recommendations", data.recommendations);
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshingPromise = null;

api.interceptors.response.use(
  (response) => {
    syncCacheFromResponse(response.config || {}, response.data);
    return response;
  },
  async (error) => {
    const originalRequest = error.config || {};
    const status = error?.response?.status;
    const refreshToken = localStorage.getItem("refreshToken");

    if (status === 401 && refreshToken && !originalRequest._retry && !String(originalRequest.url || "").includes("/api/auth/refresh")) {
      originalRequest._retry = true;
      try {
        refreshingPromise = refreshingPromise || refreshClient.post("/api/auth/refresh", { refreshToken });
        const res = await refreshingPromise;
        refreshingPromise = null;
        if (res.data?.token) {
          localStorage.setItem("token", res.data.token);
          if (res.data?.user) {
            localStorage.setItem("user", JSON.stringify(res.data.user));
          }
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${res.data.token}`;
          return api.request(originalRequest);
        }
      } catch (refreshError) {
        refreshingPromise = null;
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
        window.dispatchEvent(new Event("auth:logout"));
      }
    }

    if (!error?.response) {
      const offlineResponse = buildOfflineResponse(originalRequest);
      if (offlineResponse) {
        return Promise.resolve(offlineResponse);
      }
    }

    if (status === 401) {
      window.dispatchEvent(new Event("auth:logout"));
    }

    return Promise.reject(error);
  }
);

export default api;
export { API_BASE_URL, SOCKET_URL, refreshClient };
