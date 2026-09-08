from pydantic import BaseModel, Field


class CarbonCreditRequest(BaseModel):
    """Farm-practice inputs used to estimate carbon-credit potential."""

    farm_id: str = Field(min_length=1)
    crop: str
    farm_area: float = Field(gt=0)
    area_unit: str = "acre"

    irrigation_method: str
    fertilizer_type: str
    tillage_practice: str
    residue_management: str

    fertilizer_quantity_kg: float = Field(default=0, ge=0)
    water_usage_liters_per_day: float = Field(default=0, ge=0)
