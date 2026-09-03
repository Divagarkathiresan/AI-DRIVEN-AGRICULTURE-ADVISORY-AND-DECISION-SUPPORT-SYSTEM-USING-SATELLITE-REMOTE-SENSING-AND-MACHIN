"""MongoDB document schema for consolidated irrigation reports."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class Weather(BaseModel):
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    rainfall: Optional[float] = None
    wind_speed: Optional[float] = None
    rain_probability: Optional[float] = None


class Satellite(BaseModel):
    average_ndvi: Optional[float] = None
    health_score: Optional[int] = None
    healthy_area: Optional[float] = None
    status: str
    satellite_image_url: Optional[str] = None
    ndvi_image_url: Optional[str] = None
    recommendation: str


class SoilMoisture(BaseModel):
    soil_moisture_score: Optional[int] = None
    soil_moisture_level: str


class WaterRequirement(BaseModel):
    crop: str
    farm_area: float
    unit: str
    water_requirement_mm_per_day: float
    water_required_liters: float


class Recommendation(BaseModel):
    irrigation_status: str
    recommendation: str
    best_irrigation_time: Optional[str] = None
    soil_moisture_level: str
    soil_moisture_score: Optional[int] = None
    estimated_water_required_liters: Optional[float] = None
    estimated_water_saved_liters: Optional[float] = None
    generated_at: datetime


class IrrigationReport(BaseModel):
    """Document stored in MongoDB's irrigation_reports collection."""

    farm_id: str
    report_date: str
    crop_name: str
    location: dict
    weather: Weather
    satellite: Satellite
    soil_moisture: SoilMoisture
    water_requirement: WaterRequirement
    recommendation: Recommendation
    crop_day: Optional[int] = None
    crop_stage: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
