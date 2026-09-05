// Safe wrappers around Web Storage APIs.
// Uses try/catch to gracefully handle Safari private mode, quota errors,
// and disabled storage. Every call logs failures instead of swallowing them.

const safeStorage = {
  get(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (err) {
      console.warn(`[safeStorage] read failed for "${key}":`, err);
      return null;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (err) {
      console.warn(`[safeStorage] write failed for "${key}":`, err);
      return false;
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(key);
      return true;
    } catch (err) {
      console.warn(`[safeStorage] remove failed for "${key}":`, err);
      return false;
    }
  },
  getJSON(key, fallback = null) {
    const raw = this.get(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch (err) {
      console.warn(`[safeStorage] JSON parse failed for "${key}":`, err);
      return fallback;
    }
  },
  setJSON(key, value) {
    try {
      return this.set(key, JSON.stringify(value));
    } catch (err) {
      console.warn(`[safeStorage] JSON stringify failed for "${key}":`, err);
      return false;
    }
  },
};

export default safeStorage;
