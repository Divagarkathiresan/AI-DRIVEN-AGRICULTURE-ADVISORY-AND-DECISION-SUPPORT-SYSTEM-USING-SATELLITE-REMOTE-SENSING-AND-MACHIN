import os
import re
import requests
from irrigation.weather import WeatherService
from irrigation.soil_moisture import SoilMoistureEstimator
from irrigation.water_requirement import WaterRequirementCalculator
from irrigation.recommendation import IrrigationRecommendation
from app.database.models import get_farm_by_id
from satellite.ndvi import generate_ndvi


def _download_ndvi_images(farm_name: str, report_date: str, satellite: dict) -> dict:
    """Download NDVI and satellite images into output/ndvi_images/<farm_name>_<date>/.
    Skips download if the folder already exists. Returns updated URL fields."""

    safe_name = re.sub(r"[^\w\-]", "_", farm_name)
    folder_name = f"{safe_name}_{report_date}"
    folder_path = os.path.join("output", "ndvi_images", folder_name)

    if os.path.exists(folder_path):
        return satellite

    os.makedirs(folder_path, exist_ok=True)

    url_fields = {
        "ndvi_image_url": "ndvi.png",
        "satellite_image_url": "satellite.png",
    }

    for field, filename in url_fields.items():
        url = satellite.get(field)
        if not url or not url.startswith("http"):
            continue
        try:
            response = requests.get(url, timeout=60)
            response.raise_for_status()
            file_path = os.path.join(folder_path, filename)
            with open(file_path, "wb") as f:
                f.write(response.content)
            satellite[field] = file_path
        except Exception:
            pass

    return satellite


class IrrigationService:

    @staticmethod
    def generate_irrigation_plan(farm_id: str, report_date: str = None):

        # -----------------------------------------
        # Get Farm Details
        # -----------------------------------------

        # farm = farm_collection.find_one(
        #     {"farm_id": farm_id}
        # )
        farm = get_farm_by_id(farm_id)

        if farm is None:
            return {
                "success": False,
                "message": "Farm not found."
            }

        latitude = farm["location"]["latitude"]
        longitude = farm["location"]["longitude"]

        crop_name = farm["crop_name"]

        area = farm["area"]["value"]
        unit = farm["area"]["unit"]

        # -----------------------------------------
        # Weather
        # -----------------------------------------

        weather = WeatherService.get_weather(
            latitude,
            longitude,
            report_date
        )

        # -----------------------------------------
        # Satellite NDVI
        # -----------------------------------------

        satellite = generate_ndvi(
            latitude,
            longitude,
            report_date
        )

        if satellite:
            farm_name = farm.get("farm_name", farm_id)
            satellite = _download_ndvi_images(farm_name, report_date, satellite)

        if not satellite:
            water = WaterRequirementCalculator.calculate(

                crop_name=crop_name,

                area=area,

                unit=unit

            )

            return {
                "success": False,
                "reason": "satellite_unavailable",
                "message": "No satellite image found for this location.",
                "weather": weather,
                "water_requirement": water
            }

        ndvi = satellite["average_ndvi"]

        # -----------------------------------------
        # Soil Moisture
        # -----------------------------------------

        soil = SoilMoistureEstimator.estimate(

            ndvi=ndvi,

            temperature=weather["temperature"],

            humidity=weather["humidity"],

            rainfall=weather["rainfall"],

            rain_probability=weather["rain_probability"]

        )

        # -----------------------------------------
        # Crop Water Requirement
        # -----------------------------------------

        water = WaterRequirementCalculator.calculate(

            crop_name=crop_name,

            area=area,

            unit=unit

        )

        # -----------------------------------------
        # Final Recommendation
        # -----------------------------------------

        recommendation = IrrigationRecommendation.generate(

            soil_moisture_level=soil["soil_moisture_level"],

            soil_moisture_score=soil["soil_moisture_score"],

            rain_probability=weather["rain_probability"],

            rainfall=weather["rainfall"],

            temperature=weather["temperature"],

            water_required_liters=water["water_required_liters"]

        )

        # -----------------------------------------
        # Final Response
        # -----------------------------------------

        return {

            "farm_id": farm_id,

            "crop_name": crop_name,

            "location": {
                "latitude": latitude,
                "longitude": longitude
            },

            "weather": weather,

            # Keep every NDVI value in one place in the response.
            "satellite": {
                "average_ndvi": ndvi,
                "health_score": satellite["health_score"],
                "healthy_area": satellite["healthy_area"],
                "status": satellite["status"],
                "satellite_image_url": satellite["satellite_image_url"],
                "ndvi_image_url": satellite["ndvi_image_url"],
                "recommendation": {
                    "Excellent": "Crop is healthy. Continue current practices.",
                    "Good": "Crop is doing well. Monitor for any changes.",
                    "Moderate": "Crop health is moderate. Consider additional fertilization.",
                    "Critical": "Crop health is critical. Immediate attention required."
                }.get(satellite["status"], "")
            },

            "soil_moisture": soil,

            "water_requirement": water,

            "recommendation": recommendation

        }
