// Offline cache + write queue for SolarSafe pro
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const CACHE_PREFIX = "solarsafe_cache_";
const QUEUE_KEY = "solarsafe_offline_queue";

const readCache = (key) => {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
};

const writeCache = (key, data) => {
  try {
    localStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ ts: Date.now(), data })
    );
  } catch (_) {}
};

/** GET with offline fallback: tries network first, falls back to cached data. */
export const cachedGet = async (key, path, config = {}) => {
  try {
    const res = await axios.get(`${API}${path}`, { timeout: 10000, ...config });
    writeCache(key, res.data);
    return { data: res.data, offline: false };
  } catch (err) {
    const cached = readCache(key);
    if (cached) return { data: cached.data, offline: true, cachedAt: cached.ts };
    throw err;
  }
};

/** POST with offline queueing: sends immediately if online, queues otherwise. */
export const queuedPost = async (path, payload) => {
  if (!navigator.onLine) {
    enqueue({ path, payload, at: Date.now() });
    return { queued: true };
  }
  try {
    const res = await axios.post(`${API}${path}`, payload, { timeout: 15000 });
    return { queued: false, data: res.data };
  } catch (err) {
    if (!navigator.onLine || err.code === "ERR_NETWORK") {
      enqueue({ path, payload, at: Date.now() });
      return { queued: true };
    }
    throw err;
  }
};

const readQueue = () => {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch (_) {
    return [];
  }
};

const writeQueue = (q) => {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch (_) {}
};

const enqueue = (item) => {
  const q = readQueue();
  q.push(item);
  writeQueue(q);
  window.dispatchEvent(new CustomEvent("solarsafe:queue-changed", { detail: { size: q.length } }));
};

/** Flush the queue back to the server when connection returns. */
export const flushQueue = async () => {
  const q = readQueue();
  if (q.length === 0) return { flushed: 0, failed: 0 };
  const remaining = [];
  let flushed = 0;
  for (const item of q) {
    try {
      await axios.post(`${API}${item.path}`, item.payload, { timeout: 15000 });
      flushed += 1;
    } catch (_) {
      remaining.push(item);
    }
  }
  writeQueue(remaining);
  window.dispatchEvent(new CustomEvent("solarsafe:queue-changed", { detail: { size: remaining.length } }));
  return { flushed, failed: remaining.length };
};

export const getQueueSize = () => readQueue().length;

/** React helper: subscribes to online/offline + queue-changed events. */
export const subscribeConnectivity = (cb) => {
  const emit = () =>
    cb({ online: navigator.onLine, queued: getQueueSize() });
  const handler = () => emit();
  window.addEventListener("online", handler);
  window.addEventListener("offline", handler);
  window.addEventListener("solarsafe:queue-changed", handler);
  emit();
  return () => {
    window.removeEventListener("online", handler);
    window.removeEventListener("offline", handler);
    window.removeEventListener("solarsafe:queue-changed", handler);
  };
};

/** Auto-flush when coming back online. */
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    flushQueue().catch(() => {});
  });
}
