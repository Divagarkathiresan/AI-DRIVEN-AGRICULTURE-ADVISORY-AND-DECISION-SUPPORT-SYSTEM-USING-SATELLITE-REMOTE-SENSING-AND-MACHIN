export type AreaUnit = "acre" | "hectare";

export type FarmLocation = {
  latitude: number;
  longitude: number;
};

export type FarmArea = {
  value: number;
  unit: AreaUnit;
};

export type FarmFormValues = {
  user_id: string;
  farm_name: string;
  crop_name: string;
  area: FarmArea;
  location: FarmLocation;
  soil_type?: string;
  irrigation_type?: string;
  planting_date?: string;
  description?: string;
};

export type Farm = FarmFormValues & {
  _id?: string;
  id?: string;
  status?: string;
  created_at?: string;
};

export type AppNotification = {
  id: string;
  farmId: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
};

export type CropPredictionInput = {
  phone: string;
  N: number;
  P: number;
  K: number;
  temperature: number;
  humidity: number;
  ph: number;
  rainfall: number;
};

export type CropPredictionResult = {
  recommended_crop: string;
  confidence?: number;
  suitable_soil?: string;
  suitable_temperature?: string;
  suitable_rainfall?: string;
  reasons?: string[];
};

export type AuthSession = {
  isAuthenticated: boolean;
  phone: string;
  name?: string;
  userId: string;
  accessToken: string;
};

export type IrrigationReport = {
  farm_id: string;
  report_date: string;
  crop_day?: number | null;
  crop_stage?: string | null;
  crop_name: string;
  location?: Record<string, unknown>;
  weather?: {
    temperature?: number | null;
    humidity?: number | null;
    rainfall?: number | null;
    wind_speed?: number | null;
    rain_probability?: number | null;
  } | null;
  satellite?: {
    average_ndvi?: number | null;
    health_score?: number | null;
    healthy_area?: number | null;
    status?: string | null;
    satellite_image_url?: string | null;
    ndvi_image_url?: string | null;
    recommendation?: string | null;
  } | null;
  soil_moisture?: {
    soil_moisture_score?: number | null;
    soil_moisture_level?: string | null;
  } | null;
  water_requirement?: {
    crop?: string | null;
    farm_area?: number | null;
    unit?: string | null;
    water_requirement_mm_per_day?: number | null;
    water_required_liters?: number | null;
  } | null;
  recommendation?: {
    irrigation_status?: string | null;
    recommendation?: string | null;
    best_irrigation_time?: string | null;
    soil_moisture_level?: string | null;
    soil_moisture_score?: number | null;
    estimated_water_required_liters?: number | null;
    estimated_water_saved_liters?: number | null;
    generated_at?: string | null;
  } | null;
};
