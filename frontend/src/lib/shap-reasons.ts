/**
 * Plain-language reasons for each SHAP feature name the backend's
 * FeatureEngineer produces (backend/app/ml/feature_engineering.py,
 * FEATURE_NAMES). Judges reading "dist_to_city_center: 1.67" get nothing;
 * an investigator reading a sentence gets something they can act on.
 */
const REASONS: Record<string, string> = {
  hour: "Time of day matches hours with historically elevated fraud activity.",
  day_of_week: "Day of week matches a recurring pattern in prior incidents.",
  month: "Seasonal pattern detected for incidents reported this month.",
  is_weekend: "Incident occurred on a weekend, matching known fraud timing.",
  is_holiday_period: "Incident occurred during a high-fraud holiday window.",
  dist_to_city_center: "Predicted cash-out point is unusually far from the city center.",
  dist_to_atm: "Distance to the nearest known ATM cluster is a strong signal here.",
  tfidf_sum: "Complaint narrative closely matches language from known fraud scripts.",
  ner_loc_count: "Complaint text references multiple distinct locations.",
  bank_name_indicator: "Complaint text names a specific bank — a common social-engineering tell.",
  amount_log: "Amount defrauded is well outside the typical range for this category.",
  amount_percentile: "Amount defrauded is in the upper percentile of recent complaints.",
  is_round_number: "Amount is a suspiciously round figure.",
  state_encoded: "Jurisdiction matches a known high-incidence cluster.",
  district_encoded: "District matches a known high-incidence cluster.",
  category_encoded: "This fraud category strongly correlates with the predicted outcome.",
  bank_encoded: "Victim's bank matches a frequently targeted institution.",
};

export function shapReason(featureName: string): string {
  return REASONS[featureName] ?? "Contributed to the model's prediction for this incident.";
}
