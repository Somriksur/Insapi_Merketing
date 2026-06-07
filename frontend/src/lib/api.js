import axios from "axios";

// Use Electron-injected URL if available, otherwise use env variable
const BACKEND_URL = 
  (typeof window !== "undefined" && window.insapiMarketing?.backendUrl) || 
  process.env.REACT_APP_BACKEND_URL || 
  "http://127.0.0.1:51808";

export const API_BASE = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});
