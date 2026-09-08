"""Project-level carbon-credit potential estimation.

The factors in this module are simplified advisory coefficients.  They do not
represent a certified methodology and the generated output must not be used to
issue or verify carbon credits.
"""

from datetime import datetime


BASELINE_FACTORS = {
    "irrigation": {"Flood": 1.00, "Sprinkler": 0.70, "Drip": 0.50},
    "fertilizer": {"Chemical": 1.00, "Organic": 0.60, "Organic + Chemical": 0.80},
    "tillage": {"Conventional": 1.00, "Reduced": 0.70, "Zero": 0.50},
    "residue": {"Burned": 1.00, "Removed": 0.80, "Retained": 0.50},
}

CROP_FACTORS = {"Tomato": 1.20, "Potato": 1.00, "Pepper": 1.10}


def calculate_baseline_emission(
    crop: str, farm_area: float, fertilizer_quantity: float, water_usage: float
) -> float:
    """Return a simplified baseline emission estimate in tCO2e."""
    crop_factor = CROP_FACTORS.get(crop, 1.0)
    fertilizer_emission = fertilizer_quantity * 0.005
    water_emission = water_usage * 0.0001
    land_emission = farm_area * crop_factor
    return round(land_emission + fertilizer_emission + water_emission, 4)


def calculate_practice_factor(
    irrigation_method: str,
    fertilizer_type: str,
    tillage_practice: str,
    residue_management: str,
) -> float:
    """Return the average relative emissions factor for selected practices."""
    factors = (
        BASELINE_FACTORS["irrigation"].get(irrigation_method, 1.0),
        BASELINE_FACTORS["fertilizer"].get(fertilizer_type, 1.0),
        BASELINE_FACTORS["tillage"].get(tillage_practice, 1.0),
        BASELINE_FACTORS["residue"].get(residue_management, 1.0),
    )
    return round(sum(factors) / len(factors), 4)


def calculate_project_emission(baseline_emission: float, practice_factor: float) -> float:
    return round(baseline_emission * practice_factor, 4)


def calculate_carbon_benefit(baseline_emission: float, project_emission: float) -> float:
    return round(max(baseline_emission - project_emission, 0), 4)


def generate_carbon_report(
    crop: str,
    farm_area: float,
    area_unit: str,
    irrigation_method: str,
    fertilizer_type: str,
    tillage_practice: str,
    residue_management: str,
    fertilizer_quantity_kg: float,
    water_usage_liters_per_day: float,
) -> dict:
    """Generate an advisory carbon-benefit estimate from farm practices."""
    if crop not in CROP_FACTORS:
        raise ValueError("Crop must be Tomato, Potato or Pepper")

    baseline_emission = calculate_baseline_emission(
        crop, farm_area, fertilizer_quantity_kg, water_usage_liters_per_day
    )
    practice_factor = calculate_practice_factor(
        irrigation_method, fertilizer_type, tillage_practice, residue_management
    )
    project_emission = calculate_project_emission(baseline_emission, practice_factor)
    carbon_benefit = calculate_carbon_benefit(baseline_emission, project_emission)

    if carbon_benefit >= 5:
        status = "High Carbon Benefit"
    elif carbon_benefit >= 2:
        status = "Moderate Carbon Benefit"
    elif carbon_benefit > 0:
        status = "Low Carbon Benefit"
    else:
        status = "No Significant Benefit"

    recommendations = []
    if irrigation_method != "Drip":
        recommendations.append("Consider drip irrigation to improve water efficiency.")
    if fertilizer_type == "Chemical":
        recommendations.append("Consider integrating organic fertilizer with chemical fertilizer.")
    if tillage_practice == "Conventional":
        recommendations.append("Consider reduced or zero tillage.")
    if residue_management == "Burned":
        recommendations.append("Avoid residue burning and consider retaining crop residues.")
    if not recommendations:
        recommendations.append("Current farming practices show good carbon-management potential.")

    return {
        "crop": crop,
        "farm_area": farm_area,
        "area_unit": area_unit,
        "baseline_emission_tco2e": baseline_emission,
        "project_emission_tco2e": project_emission,
        "estimated_co2e_reduction_tco2e": carbon_benefit,
        "estimated_carbon_credit_potential": carbon_benefit,
        "unit": "tCO2e",
        "carbon_status": status,
        "practice_factor": practice_factor,
        "practices": {
            "irrigation": irrigation_method,
            "fertilizer": fertilizer_type,
            "tillage": tillage_practice,
            "residue_management": residue_management,
        },
        "recommendations": recommendations,
        "generated_at": datetime.utcnow().isoformat(),
        "calculation_status": "Estimated",
        "methodology_notice": (
            "This is an advisory estimate using simplified project coefficients; "
            "it is not an official carbon-credit verification or issuance."
        ),
    }
