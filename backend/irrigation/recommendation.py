from datetime import datetime


class IrrigationRecommendation:

    @staticmethod
    def generate(
        soil_moisture_level: str,
        soil_moisture_score: int,
        rain_probability: float,
        rainfall: float,
        temperature: float,
        water_required_liters: float
    ):

        rain_probability = rain_probability or 0
        rainfall = rainfall or 0
        temperature = temperature or 0
        water_required_liters = water_required_liters or 0

        # ---------------------------------
        # ---------------------------------

        if rain_probability >= 70:

            status = "Postpone Irrigation"

            recommendation = (
                "High probability of rainfall. Delay irrigation until rainfall is observed."
            )

        elif rainfall >= 5:

            status = "No Irrigation Needed"

            recommendation = (
                "Recent rainfall is sufficient. No irrigation is required today."
            )

        elif soil_moisture_level == "High":

            status = "No Irrigation Needed"

            recommendation = (
                "Soil moisture is already high. Avoid over-irrigation."
            )

        elif soil_moisture_level == "Moderate":

            status = "Light Irrigation"

            recommendation = (
                "Apply a moderate amount of water to maintain soil moisture."
            )

        else:

            status = "Immediate Irrigation"

            recommendation = (
                "Soil moisture is low. Irrigate the field as soon as possible."
            )

        # ---------------------------------
        # Best Irrigation Time
        # ---------------------------------

        if temperature >= 35:

            best_time = "06:00 AM - 08:00 AM"

        elif temperature >= 30:

            best_time = "06:00 AM - 09:00 AM"

        else:

            best_time = "05:00 PM - 07:00 PM"

        # ---------------------------------
        # Water Saving Estimate
        # ---------------------------------

        if status == "Postpone Irrigation":
            water_saved = water_required_liters

        elif status == "No Irrigation Needed":
            water_saved = water_required_liters

        elif status == "Light Irrigation":
            water_saved = water_required_liters * 0.30

        else:
            water_saved = 0

        return {

            "irrigation_status": status,

            "recommendation": recommendation,

            "best_irrigation_time": best_time,

            "soil_moisture_level": soil_moisture_level,

            "soil_moisture_score": soil_moisture_score,

            "estimated_water_required_liters": round(
                water_required_liters,
                2
            ),

            "estimated_water_saved_liters": round(
                water_saved,
                2
            ),

            "generated_at": datetime.utcnow().isoformat()

        }