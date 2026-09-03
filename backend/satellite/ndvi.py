import os
import sys
import ee
import geemap
from ee.ee_exception import EEException
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import initialize_gee
from fetch_image import fetch_satellite_image


def calculate_health_score(avg_ndvi):

    if avg_ndvi >= 0.75:
        return 100, "Excellent"

    elif avg_ndvi >= 0.60:
        return 85, "Good"

    elif avg_ndvi >= 0.40:
        return 65, "Moderate"

    else:
        return 40, "Critical"


def generate_ndvi(
    latitude,
    longitude,
    target_date,
    search_days=30,
    max_cloud_percentage=20
):

    initialize_gee()

    os.makedirs("output", exist_ok=True)

    # ----------------------------
    # Farm Area
    # ----------------------------

    point = ee.Geometry.Point([longitude, latitude])

    roi = point.buffer(500).bounds()

    # ----------------------------
    # Target Date
    # ----------------------------

    try:
        target_datetime = datetime.strptime(
            target_date,
            "%Y-%m-%d"
        )
    except ValueError:
        raise ValueError(
            "target_date must be in YYYY-MM-DD format"
        )

    # ----------------------------
    # Search Date Range
    # ----------------------------

    start = target_datetime - timedelta(days=search_days)

    end = target_datetime + timedelta(days=search_days + 1)

    # ----------------------------
    # Get Sentinel-2 Images
    # ----------------------------

    collection = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")

        # Only images covering the farm area
        .filterBounds(roi)

        # Search around target date
        .filterDate(
            start.strftime("%Y-%m-%d"),
            end.strftime("%Y-%m-%d")
        )

        # Remove highly cloudy images
        .filter(
            ee.Filter.lte(
                "CLOUDY_PIXEL_PERCENTAGE",
                max_cloud_percentage
            )
        )
    )

    # ----------------------------
    # Check Images
    # ----------------------------

    try:

        image_count = collection.size().getInfo()

        if image_count == 0:
            return None

    except EEException:

        return None

    # ----------------------------
    # Find Nearest Image
    # ----------------------------

    target_ee_date = ee.Date(
        target_datetime.strftime("%Y-%m-%d")
    )

    def calculate_date_difference(image):

        image_date = ee.Date(
            image.get("system:time_start")
        )

        difference = image_date.difference(
            target_ee_date,
            "day"
        ).abs()

        return image.set(
            "date_difference",
            difference
        )

    collection = collection.map(
        calculate_date_difference
    )

    # Sort from nearest date to farthest date
    collection = collection.sort(
        "date_difference"
    )

    # Get nearest suitable image
    image = collection.first()

    # ----------------------------
    # Get Image Information
    # ----------------------------

    try:

        image_info = image.getInfo()

        if image_info is None:
            return None

        image_id = image.get(
            "system:index"
        ).getInfo()

    except EEException:

        return None

    if not image_id:
        return None

    # ----------------------------
    # Actual Satellite Image Date
    # ----------------------------

    try:

        image_timestamp = image.get(
            "system:time_start"
        ).getInfo()

        satellite_image_date = datetime.fromtimestamp(
            image_timestamp / 1000
        ).strftime("%Y-%m-%d")

    except EEException:

        return None

    # ----------------------------
    # Cloud Percentage
    # ----------------------------

    try:

        cloud_percentage = image.get(
            "CLOUDY_PIXEL_PERCENTAGE"
        ).getInfo()

    except EEException:

        cloud_percentage = None

    # ----------------------------
    # NDVI
    # ----------------------------

    ndvi = (
        image
        .normalizedDifference(["B8", "B4"])
        .rename("NDVI")
        .updateMask(
            image
            .normalizedDifference(["B8", "B4"])
            .gt(0.2)
        )
    )

    # ----------------------------
    # Color Palette
    # ----------------------------

    ndvi_rgb = ndvi.visualize(
        min=0,
        max=1,
        palette=[
            "red",
            "yellow",
            "green"
        ]
    )

    # ----------------------------
    # Export GeoTIFF
    # ----------------------------

    geemap.ee_export_image(
        ndvi,
        filename="output/ndvi.tif",
        scale=10,
        region=roi
    )

    # ----------------------------
    # Generate PNG URL
    # ----------------------------

    url = ndvi_rgb.getThumbURL({
        "region": roi,
        "dimensions": 1024,
        "format": "png"
    })

    # ----------------------------
    # Average NDVI
    # ----------------------------

    stats = ndvi.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=roi,
        scale=10,
        maxPixels=1e9
    )

    try:

        average_ndvi = stats.get(
            "NDVI"
        ).getInfo()

    except EEException:

        return None

    if average_ndvi is None:
        return None

    # ----------------------------
    # Health Score
    # ----------------------------

    score, status = calculate_health_score(
        average_ndvi
    )

    # ----------------------------
    # Healthy Area Percentage
    # ----------------------------

    healthy_mask = ndvi.gte(0.5)

    healthy_stats = healthy_mask.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=roi,
        scale=10,
        maxPixels=1e9
    )

    try:

        healthy_mean = healthy_stats.get(
            "NDVI"
        ).getInfo()

    except EEException:

        return None

    healthy_percentage = (
        healthy_mean or 0
    ) * 100

    # ----------------------------
    # Result
    # ----------------------------

    return {

        # Requested date
        "target_date": target_date,

        # Actual satellite acquisition date
        "image_date": satellite_image_date,

        # Difference between requested
        # date and satellite acquisition date
        "days_difference": abs(
            (
                datetime.strptime(
                    satellite_image_date,
                    "%Y-%m-%d"
                )
                - target_datetime
            ).days
        ),

        # Image cloud percentage
        "cloud_percentage": cloud_percentage,

        # Existing NDVI results
        "average_ndvi": round(
            average_ndvi,
            3
        ),

        "health_score": score,

        "status": status,

        "healthy_area": round(
            healthy_percentage,
            2
        ),

        # Existing satellite URL
        "satellite_image_url": "satellite_url",

        # Existing NDVI URL
        "ndvi_image_url": url
    }


# ============================================================
# TEST
# ============================================================

if __name__ == "__main__":

    latitude = 10.7870
    longitude = 79.1378

    target_date = "2026-08-16"

    result = generate_ndvi(
        latitude=latitude,
        longitude=longitude,
        target_date=target_date,
        search_days=30,
        max_cloud_percentage=20
    )

    print(result)