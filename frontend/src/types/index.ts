export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'officer' | 'analyst';
  department: string;
}

export interface Token {
  accessToken: string;
  refreshToken: string;
}

export interface Complaint {
  id: string;
  title: string;
  description: string;
  category: string;
  status: 'pending' | 'investigating' | 'resolved' | 'closed';
  dateReported: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  reporterId: string;
}

export interface Prediction {
  id: string;
  category: string;
  probability: number;
  timestamp: string;
  location: PredictedLocation;
  factors: FeatureImportance[];
}

export interface PredictedLocation {
  lat: number;
  lng: number;
  radius: number;
  region: string;
}

export interface HotspotData {
  id: string;
  lat: number;
  lng: number;
  intensity: number;
  radius: number;
  crimeType: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface HeatmapPoint {
  lat: number;
  lng: number;
  weight: number;
}

export interface IntelligenceReport {
  id: string;
  title: string;
  summary: string;
  dateGenerated: string;
  dataSources: string[];
  keyFindings: string[];
  recommendations: string[];
}

export interface AlertData {
  id: string;
  type: 'prediction' | 'anomaly' | 'system';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
  acknowledged: boolean;
  metadata?: any;
}

export interface TrendData {
  date: string;
  count: number;
  category?: string;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
}

export interface WebSocketMessage {
  type: string;
  payload: any;
}

export interface StatsData {
  totalComplaints: number;
  activeInvestigations: number;
  resolvedCases: number;
  highRiskAreas: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  code: string;
  details?: any;
}
