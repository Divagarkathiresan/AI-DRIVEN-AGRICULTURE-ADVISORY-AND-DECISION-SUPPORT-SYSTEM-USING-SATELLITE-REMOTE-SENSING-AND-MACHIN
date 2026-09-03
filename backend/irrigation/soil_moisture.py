class SoilMoistureEstimator:

    @staticmethod
    def estimate(
        ndvi: float,
        temperature: float,
        humidity: float,
        rainfall: float,
        rain_probability: float
    ):

        score = 0

        ndvi = ndvi or 0
        rainfall = rainfall or 0
        humidity = humidity or 0
        temperature = temperature or 0
        rain_probability = rain_probability or 0

        # -----------------------------
        # NDVI Contribution
        # -----------------------------
        if ndvi >= 0.70:
            score += 40
        elif ndvi >= 0.50:
            score += 30
        elif ndvi >= 0.30:
            score += 20
        else:
            score += 10

        # -----------------------------
        # Rainfall Contribution
        # -----------------------------
        if rainfall >= 10:
            score += 25
        elif rainfall >= 5:
            score += 15

        # -----------------------------
        # Humidity Contribution
        # -----------------------------
        if humidity >= 80:
            score += 20
        elif humidity >= 60:
            score += 15
        elif humidity >= 40:
            score += 10

        # -----------------------------
        # Temperature Contribution
        # -----------------------------
        if temperature <= 28:
            score += 10
        elif temperature <= 35:
            score += 5

        # -----------------------------
        # Rain Forecast Contribution
        # -----------------------------
        if rain_probability >= 70:
            score += 5

        # -----------------------------
        # Final Classification
        # -----------------------------
        if score >= 75:
            level = "High"

        elif score >= 50:
            level = "Moderate"

        else:
            level = "Low"

        return {
            "soil_moisture_score": score,
            "soil_moisture_level": level
        }