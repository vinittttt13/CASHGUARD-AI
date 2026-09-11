import axios from 'axios';
import {
  getToken,
  getRefreshToken,
  setToken,
  setRefreshToken,
  clearAuth
} from './auth';
import { getRuntimeEnv } from './runtime-env';
import type {
  Alert,
  AlertListResponse,
  AmlTransactionRequest,
  AmlTransactionResponse,
  Complaint,
  ComplaintListResponse,
  HeatmapPoint,
  Hotspot,
  IntelligenceReport,
  LoginResponse,
  PredictionResponse,
  StatsAggregate,
  TrendsResponse,
  WithdrawalLocation,
  FraudRing,
} from '@/types';

const getBaseApiUrl = (): string => {
  if (typeof window !== 'undefined') {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return '';
    }
  }
  return getRuntimeEnv('NEXT_PUBLIC_API_URL', 'http://localhost:8000');
};

export const API_URL = getBaseApiUrl();

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      config.baseURL = '';
    }
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
export const loginUser = async (credentials: {
  email: string;
  password: string;
}): Promise<LoginResponse> => {
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
export const getComplaints = async (params?: {
  skip?: number;
  limit?: number;
  status?: string;
  category?: string;
  state?: string;
}): Promise<ComplaintListResponse> => {
  const { data } = await api.get('/api/v1/complaints', { params });
  return data;
};

export const getComplaint = async (id: string): Promise<Complaint> => {
  const { data } = await api.get(`/api/v1/complaints/${id}`);
  return data;
};

export const createComplaint = async (
  complaint: Partial<Complaint>,
): Promise<Complaint> => {
  const { data } = await api.post('/api/v1/complaints', complaint);
  return data;
};

export const updateComplaint = async (
  id: string,
  update: { status?: Complaint['status']; assigned_to?: string },
): Promise<Complaint> => {
  const { data } = await api.put(`/api/v1/complaints/${id}`, update);
  return data;
};

export const getComplaintStats = async (): Promise<StatsAggregate> => {
  const { data } = await api.get('/api/v1/complaints/stats/aggregate');
  return data;
};

// Predictions
export const predictComplaint = async (
  complaintId: string,
  forceRefresh = true,
): Promise<PredictionResponse> => {
  const { data } = await api.post('/api/v1/predict', {
    complaint_id: complaintId,
    force_refresh: forceRefresh,
  });
  return data;
};

export const getPrediction = async (
  predictionId: string,
): Promise<PredictionResponse> => {
  const { data } = await api.get(`/api/v1/predict/${predictionId}`);
  return data;
};

// AML transaction risk scoring
export const predictAmlTransaction = async (
  tx: AmlTransactionRequest,
): Promise<AmlTransactionResponse> => {
  const { data } = await api.post('/api/v1/predict/aml-transaction', tx);
  return data;
};

// Locations & Hotspots
export const getLocations = async (params?: {
  city?: string;
  state?: string;
  loc_type?: string;
}): Promise<WithdrawalLocation[]> => {
  const { data } = await api.get('/api/v1/locations', { params });
  return data;
};

export const getHotspots = async (): Promise<Hotspot[]> => {
  const { data } = await api.get('/api/v1/locations/hotspots');
  return data;
};

export const getHeatmapData = async (): Promise<HeatmapPoint[]> => {
  const { data } = await api.get('/api/v1/locations/heatmap');
  return data;
};

export const getNearbyLocations = async (
  lat: number,
  lng: number,
  radiusKm = 5,
): Promise<WithdrawalLocation[]> => {
  const { data } = await api.get('/api/v1/locations/nearby', {
    params: { lat, lng, radius_km: radiusKm },
  });
  return data;
};

// Intelligence & Alerts
export const getAlerts = async (): Promise<AlertListResponse> => {
  const { data } = await api.get('/api/v1/intelligence/alerts');
  return data;
};

export const acknowledgeAlert = async (id: string): Promise<Alert> => {
  const { data } = await api.put(
    `/api/v1/intelligence/alerts/${id}/acknowledge`,
  );
  return data;
};

export const getIntelligenceReport = async (
  days = 7,
): Promise<IntelligenceReport> => {
  const { data } = await api.get('/api/v1/intelligence/report', {
    params: { days },
  });
  return data;
};

export const getTrends = async (days = 30): Promise<TrendsResponse> => {
  const { data } = await api.get('/api/v1/intelligence/trends', {
    params: { days },
  });
  return data;
};

// Authenticated CSV download — the export endpoint requires a Bearer token,
// so a plain <a href> navigation (no Authorization header) would 401.
export const exportIntelligenceReport = async (days = 7): Promise<void> => {
  const response = await api.get('/api/v1/intelligence/report/export', {
    params: { days },
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = `CPAF-Intelligence-Report-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const getFraudRings = async (days = 30): Promise<FraudRing[]> => {
  const { data } = await api.get('/api/v1/intelligence/fraud-rings', {
    params: { days },
  });
  return data;
};


// Health
export const healthCheck = async () => {
  const { data } = await api.get('/health');
  return data;
};

// Machine Learning Model Operations
export interface ModelStatus {
  loaded_models: Record<string, string>;
  total_loaded: number;
  artifacts_dir: string;
  manifest?: {
    artifacts: string[];
    version: string;
    last_trained: string;
    source: string;
    sample_size: number;
  };
  metrics?: {
    model: string;
    version: string;
    trained_at: string;
    metrics: {
      version: string;
      training_samples: number;
      test_accuracy: number;
      laundering_cases_flagged: number;
      feature_importances: Record<string, number>;
      status: string;
    };
  hardware?: {
    os?: string;
    cpu_count?: number;
    gpus?: Array<{
      name?: string;
      vendor?: string;
      vram_mb?: number;
      cuda_cores?: number;
      compute_capability?: string;
      driver_version?: string;
      cuda_available?: boolean;
    }>;
    has_nvidia?: boolean;
    has_amd?: boolean;
    cuda_available?: boolean;
    primary_gpu?: string;
    xgboost_device?: string;
    xgboost_tree_method?: string;
    n_jobs?: number;
  };
}

export interface TrainModelOptions {
  source?: 'synthetic' | 'database';
  sample_size?: number;
  models?: string[];
  version?: string;
}

export interface TrainModelResult {
  status: string;
  version: string;
  duration_seconds: number;
  source: string;
  sample_size: number;
  models_trained: string[];
  metrics: Record<string, any>;
  hardware?: Record<string, any>;
  timestamp: string;
}

export const getModelStatus = async (): Promise<ModelStatus> => {
  const { data } = await api.get<ModelStatus>('/api/v1/predict/model-status');
  return data;
};

export const trainModels = async (options?: TrainModelOptions): Promise<TrainModelResult> => {
  const { data } = await api.post<TrainModelResult>('/api/v1/predict/train', options || {
    source: 'synthetic',
    sample_size: 10000,
  });
  return data;
};

export default api;

