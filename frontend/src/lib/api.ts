import axios from 'axios';
import { 
  getToken, 
  getRefreshToken, 
  setToken, 
  setRefreshToken, 
  clearAuth 
} from './auth';
import { 
  Complaint, 
  Prediction, 
  HotspotData, 
  HeatmapPoint, 
  IntelligenceReport, 
  AlertData, 
  TrendData,
  PaginatedResponse,
  Token
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Single-flight refresh: if several requests 401 at once, they all await the
// same rotation call instead of each burning the (single-use) refresh token.
let refreshPromise: Promise<string> | null = null;

const runRefresh = (): Promise<string> => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token');

    // Token travels in the JSON body, never the query string.
    const res = await axios.post<{ access_token: string; refresh_token: string }>(
      `${API_URL}/api/v1/auth/refresh`,
      { refresh_token: refreshToken }
    );

    setToken(res.data.access_token);
    if (res.data.refresh_token) {
      setRefreshToken(res.data.refresh_token);
    }
    return res.data.access_token;
  })();

  // Clear the latch once settled so the next 401 can refresh again.
  refreshPromise.finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const accessToken = await runRefresh();
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        clearAuth();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const loginUser = async (credentials: { email: string; password: string }) => {
  const { data } = await api.post('/api/v1/auth/login', credentials);
  return data;
};

export const getCurrentUser = async () => {
  const { data } = await api.get('/api/v1/auth/me');
  return data;
};

export const logoutUser = async () => {
  const { data } = await api.post('/api/v1/auth/logout', {
    refresh_token: getRefreshToken(),
  });
  return data;
};

// Complaints
export const getComplaints = async (params?: any) => {
  const { data } = await api.get('/api/v1/complaints', { params });
  return data;
};

export const getComplaint = async (id: string) => {
  const { data } = await api.get(`/api/v1/complaints/${id}`);
  return data;
};

export const createComplaint = async (complaint: Partial<Complaint>): Promise<Complaint> => {
  const { data } = await api.post('/api/v1/complaints', complaint);
  return data;
};

export const getComplaintStats = async () => {
  const { data } = await api.get('/api/v1/complaints/stats/aggregate');
  return data;
};

// Predictions
export const predictComplaint = async (complaintId: string): Promise<Prediction> => {
  const { data } = await api.post('/api/v1/predict', { complaint_id: complaintId });
  return data;
};

export const getPrediction = async (predictionId: string) => {
  const { data } = await api.get(`/api/v1/predict/${predictionId}`);
  return data;
};

// Locations & Hotspots
export const getLocations = async (params?: any) => {
  const { data } = await api.get('/api/v1/locations', { params });
  return data;
};

export const getHotspots = async (): Promise<HotspotData[]> => {
  const { data } = await api.get('/api/v1/locations/hotspots');
  return data;
};

export const getHeatmapData = async (): Promise<HeatmapPoint[]> => {
  const { data } = await api.get('/api/v1/locations/heatmap');
  return data;
};

export const getNearbyLocations = async (lat: number, lng: number, radiusKm: number = 5) => {
  const { data } = await api.get('/api/v1/locations/nearby', {
    params: { lat, lng, radius_km: radiusKm },
  });
  return data;
};

// Intelligence & Alerts
export const getAlerts = async (): Promise<AlertData[]> => {
  const { data } = await api.get('/api/v1/intelligence/alerts');
  return data;
};

export const acknowledgeAlert = async (id: string): Promise<void> => {
  await api.put(`/api/v1/intelligence/alerts/${id}/acknowledge`);
};

export const getIntelligenceReport = async (days: number = 7) => {
  const { data } = await api.get('/api/v1/intelligence/report', { params: { days } });
  return data;
};

export const getTrends = async (days: number = 30): Promise<TrendData[]> => {
  const { data } = await api.get('/api/v1/intelligence/trends', { params: { days } });
  return data;
};

// Health
export const healthCheck = async () => {
  const { data } = await api.get('/health');
  return data;
};

export default api;
