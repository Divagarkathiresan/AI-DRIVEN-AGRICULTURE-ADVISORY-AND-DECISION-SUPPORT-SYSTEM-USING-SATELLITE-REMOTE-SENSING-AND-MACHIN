class WaterRequirementCalculator:

    # Daily crop water requirement (mm/day)
    CROP_WATER_REQUIREMENT = {
        "rice": 8,
        "wheat": 5,
        "maize": 5,
        "cotton": 6,
        "sugarcane": 10,
        "banana": 7, 
        "coconut": 6,
        "groundnut": 5,
        "turmeric": 6,
        "onion": 4,
        "tomato": 5,
        "potato": 5
    }

    @staticmethod
    def calculate(crop_name: str, area: float, unit: str = "acre"):

        crop = crop_name.lower()

        # Default if crop not found
        water_mm = WaterRequirementCalculator.CROP_WATER_REQUIREMENT.get(crop, 5)

        # Convert area to square meters
        if unit.lower() == "acre":
            area_m2 = area * 4046.86

        elif unit.lower() == "hectare":
            area_m2 = area * 10000

        else:
            raise ValueError("Area unit must be 'acre' or 'hectare'.")

        # 1 mm water over 1 m² = 1 liter
        total_water = water_mm * area_m2

        return {
            "crop": crop_name.title(),
            "farm_area": area,
            "unit": unit,
            "water_requirement_mm_per_day": water_mm,
            "water_required_liters": round(total_water, 2)
        }