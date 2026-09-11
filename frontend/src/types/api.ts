// Types that mirror the FastAPI backend responses 1:1.
// Source of truth: docs/FRONTEND_BACKEND_INTEGRATION.md §1.

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type AlertPriority = "low" | "medium" | "high" | "critical";
export type ComplaintStatus =
  | "pending"
  | "processing"
  | "predicted"
  | "resolved";

export interface LoginResponse {
  access_token: string;
  token_type: string;
  refresh_token: string;
}

export interface Complaint {
  id: string;
  complaint_number: string;
  complaint_text: string;
  complaint_category: string;
  amount_defrauded: number;
  currency: string;
  state: string | null;
  district: string | null;
  city: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  status: ComplaintStatus;
  bank_name: string | null;
  account_type: string | null;
  complaint_date: string | null;
  incident_date: string | null;
  created_at: string;
  updated_at: string;
  victim_name_masked: string | null;
  victim_phone_masked: string | null;
  predictions: PredictionResponse[];
}

export interface ComplaintListResponse {
  items: Complaint[];
  total: number;
}

export interface StatsAggregate {
  by_category: Record<string, number>;
  by_state: Record<string, number>;
  by_status: Record<string, number>;
}

export interface PredictedLocation {
  lat: number;
  lng: number;
  atm_name: string | null;
  confidence: number;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
}

export interface PredictionResponse {
  id: string;
  complaint_id: string;
  predicted_latitude: number;
  predicted_longitude: number;
  confidence_score: number;
  predicted_locations: PredictedLocation[] | null;
  hotspot_cluster_id: number | null;
  model_version: string | null;
  model_name: string | null;
  feature_importance: FeatureImportance[] | null;
  risk_level: RiskLevel;
  prediction_radius_km: number | null;
  created_at: string;
}

export interface Alert {
  id: string;
  title: string;
  description: string | null;
  alert_type: string;
  priority: AlertPriority;
  latitude: number | null;
  longitude: number | null;
  radius_km: number | null;
  confidence_score: number | null;
  is_active: boolean;
  is_acknowledged: boolean;
  acknowledged_by: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface AlertListResponse {
  items: Alert[];
  total: number;
}

export interface TrendsResponse {
  period_days: number;
  total_incidents: number;
  daily_counts: Array<{ date: string; count: number }>;
  forecast: Array<{ date: string; predicted_count: number }>;
}

export interface IntelligenceReport {
  summary: string;
  period_days: number;
  total_complaints: number;
  total_defrauded_inr: number;
  active_hotspots: Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    risk_score: number;
    incident_count: number;
  }>;
  high_priority_alerts: Array<{
    id: string;
    title: string;
    priority: string;
    alert_type: string;
    created_at: string | null;
  }>;
  state_wise_breakdown: Record<string, number>;
  category_breakdown: Record<string, number>;
  top_targeted_banks: Array<[string, number]>;
  recommendations: string[];
  generated_at: string;
}

export interface Hotspot {
  cluster_id: string;
  center: [number, number];
  radius_km: number;
  incident_count: number;
  risk_score: number;
  name: string;
}

export interface HeatmapPoint {
  lat: number;
  lng: number;
  weight: number;
}

export interface WithdrawalLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  location_type: string;
  address: string | null;
  city: string | null;
  state: string | null;
  bank_name: string | null;
  risk_score: number;
  incident_count: number;
  is_active: boolean;
  distance_km?: number;
}

export interface FraudRing {
  ring_id: string;
  member_count: number;
  complaint_count: number;
  complaint_ids: string[];
  suspect_identifiers: string[];
  shared_banks: string[];
  shared_locations: string[];
  total_defrauded_inr: number;
  total_amount_lost: number;
  risk_score: number;
  confidence_score: number;
  coordination_type: string;
  pattern: string;
}

