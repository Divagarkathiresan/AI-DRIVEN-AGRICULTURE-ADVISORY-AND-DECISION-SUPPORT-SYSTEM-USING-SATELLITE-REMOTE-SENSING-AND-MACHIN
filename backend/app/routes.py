import os
import random
import requests
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from datetime import date, datetime, timedelta
from typing import Optional, List

try:
    from .model_loader import model, encoder
    from .schemas import CropInput, UserRegister, SendOTPRequest, VerifyOTPRequest
    from .farm_schema import Farm
    from .irrigation_report_schema import IrrigationReport
    from .auth import CurrentUser, create_access_token, get_current_user
    from .database.models import save_prediction, register_user, store_otp, verify_otp, create_farm, get_farm_by_id, get_farms_by_user, get_irrigation_report_by_date, get_irrigation_reports_by_farm, save_irrigation_report
    from .database import connection
    from irrigation.irrigation_service import IrrigationService
except ImportError:
    from model_loader import model, encoder
    from schemas import CropInput, UserRegister, SendOTPRequest, VerifyOTPRequest
    from farm_schema import Farm
    from irrigation_report_schema import IrrigationReport
    from auth import CurrentUser, create_access_token, get_current_user
    from database.models import save_prediction, register_user, store_otp, verify_otp, create_farm, get_farm_by_id, get_farms_by_user, get_irrigation_report_by_date, get_irrigation_reports_by_farm, save_irrigation_report
    from database import connection
    from irrigation.irrigation_service import IrrigationService

router = APIRouter()

CROP_REMAP = {
    "rice": "pepper",
    "maize": "potato",
    "pomegranate": "tomato",
}


def remap_recommended_crop(crop_name: Optional[str]) -> Optional[str]:
    if crop_name is None:
        return None
    normalized = str(crop_name).strip().lower()
    return CROP_REMAP.get(normalized, crop_name)

# Crop lifecycle definitions used to determine the current crop stage from crop_day
CROP_LIFECYCLE = {
    "tomato": {
        "total_days": 120,
        "stages": [
            {"name": "Establishment", "start": 0, "end": 14},
            {"name": "Vegetative Growth", "start": 15, "end": 35},
            {"name": "Flowering", "start": 36, "end": 55},
            {"name": "Fruit Development", "start": 56, "end": 80},
            {"name": "Fruit Ripening", "start": 81, "end": 105},
            {"name": "Harvest", "start": 106, "end": 120}
        ]
    },
    "potato": {
        "total_days": 120,
        "stages": [
            {"name": "Sprouting / Emergence", "start": 0, "end": 20},
            {"name": "Vegetative Growth", "start": 21, "end": 40},
            {"name": "Tuber Initiation", "start": 41, "end": 60},
            {"name": "Tuber Bulking", "start": 61, "end": 90},
            {"name": "Maturation", "start": 91, "end": 110},
            {"name": "Harvest", "start": 111, "end": 120}
        ]
    },
    "pepper": {
        "total_days": 120,
        "stages": [
            {"name": "Establishment", "start": 0, "end": 15},
            {"name": "Vegetative Growth", "start": 16, "end": 40},
            {"name": "Flowering", "start": 41, "end": 60},
            {"name": "Fruit Development", "start": 61, "end": 85},
            {"name": "Fruit Maturation", "start": 86, "end": 110},
            {"name": "Harvest", "start": 111, "end": 120}
        ]
    }
}


def compute_crop_stage(crop_name: Optional[str], crop_day: Optional[int]) -> Optional[str]:
    """Return the stage name for a crop given its crop_day using CROP_LIFECYCLE.

    Returns None if no appropriate stage can be determined.
    """
    if crop_day is None or not crop_name:
        return None

    name_lower = crop_name.lower()
    for key, lifecycle in CROP_LIFECYCLE.items():
        if key in name_lower:
            stages = lifecycle.get("stages", [])
            for s in stages:
                if s.get("start") <= crop_day <= s.get("end"):
                    return s.get("name")
            # If beyond defined total_days
            if crop_day > lifecycle.get("total_days", 0):
                return "Post-harvest"
            return None
    return None


@router.get("/farm/{farm_id}/irrigation/report", response_model=IrrigationReport)
def get_irrigation_report(
    farm_id: str,
    report_date: date = Query(default_factory=date.today),
    current_user: CurrentUser = Depends(get_current_user)
):
    farm = get_farm_by_id(farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    if farm.get("user_id") != current_user.user_id:
        raise HTTPException(status_code=403, detail="You do not have access to this farm")

    report = get_irrigation_report_by_date(farm_id, report_date.isoformat())
    if not report:
        raise HTTPException(
            status_code=404,
            detail=f"No irrigation report found for date {report_date.isoformat()}",
        )

    # Calculate crop day from planting_date if available
    planting = farm.get("planting_date")
    crop_day = None
    if planting:
        try:
            if isinstance(planting, str):
                planting_dt = datetime.fromisoformat(planting)
            else:
                planting_dt = planting
            planting_date_only = planting_dt.date()
            days = (report_date - planting_date_only).days + 1
            crop_day = max(1, days)
        except Exception:
            crop_day = None

    report.pop("_id", None)
    if crop_day is not None:
        report["crop_day"] = crop_day
        # compute crop stage using farm crop_name
        crop_stage = compute_crop_stage(farm.get("crop_name"), crop_day)
        if crop_stage is not None:
            report["crop_stage"] = crop_stage
    return report


def _generate_plan_for_date(farm_id: str, farm: dict, report_date: date):
    """Core logic shared by single and bulk irrigation plan routes.
    Returns a dict (report data) or a JSONResponse (satellite unavailable).
    Raises HTTPException on hard failures."""

    report_date_value = report_date.isoformat()

    crop_day: Optional[int] = None
    planting = farm.get("planting_date")
    if planting:
        try:
            if isinstance(planting, str):
                planting_dt = datetime.fromisoformat(planting)
            else:
                planting_dt = planting
            planting_date_only = planting_dt.date()
            days = (report_date - planting_date_only).days + 1
            crop_day = max(1, days)
        except Exception:
            crop_day = None

    saved_report = get_irrigation_report_by_date(farm_id, report_date_value)
    if saved_report:
        saved_report.pop("_id", None)
        if crop_day is not None and not saved_report.get("crop_day"):
            saved_report["crop_day"] = crop_day
            try:
                crop_stage_val = compute_crop_stage(farm.get("crop_name"), crop_day)
                if crop_stage_val:
                    saved_report["crop_stage"] = crop_stage_val
            except Exception:
                pass
        return saved_report

    result = IrrigationService.generate_irrigation_plan(farm_id, report_date_value)

    if result.get("success") is False:
        if result.get("reason") == "satellite_unavailable":
            return {
                "farm_id": farm_id,
                "report_date": report_date_value,
                "crop_name": farm.get("crop_name", ""),
                "location": farm.get("location", {}),
                "weather": result.get("weather"),
                "crop_day": crop_day,
                "crop_stage": compute_crop_stage(farm.get("crop_name", ""), crop_day),
                "satellite": {
                    "average_ndvi": None,
                    "health_score": None,
                    "healthy_area": None,
                    "status": "Satellite data unavailable",
                    "satellite_image_url": None,
                    "ndvi_image_url": None,
                    "recommendation": result["message"],
                },
                "soil_moisture": {
                    "soil_moisture_score": None,
                    "soil_moisture_level": "Unavailable",
                },
                "water_requirement": result.get("water_requirement"),
                "recommendation": {
                    "irrigation_status": "Unavailable",
                    "recommendation": "Satellite data is unavailable for this farm right now. Try again after new imagery is available.",
                    "best_irrigation_time": None,
                    "soil_moisture_level": "Unavailable",
                    "soil_moisture_score": None,
                    "estimated_water_required_liters": result.get("water_requirement", {}).get("water_required_liters"),
                    "estimated_water_saved_liters": None,
                    "generated_at": datetime.utcnow().isoformat(),
                },
            }
        raise HTTPException(status_code=404, detail=result["message"])

    crop_stage = compute_crop_stage(result.get("crop_name") or farm.get("crop_name"), crop_day)

    report = IrrigationReport(
        farm_id=farm_id,
        report_date=report_date_value,
        crop_name=result["crop_name"],
        location=result["location"],
        weather=result["weather"],
        satellite=result["satellite"],
        soil_moisture=result["soil_moisture"],
        water_requirement=result["water_requirement"],
        recommendation=result["recommendation"],
        crop_day=crop_day,
        crop_stage=crop_stage,
    )
    save_irrigation_report(report.model_dump())
    return report.model_dump()


@router.get("/farm/{farm_id}/irrigation", response_model=IrrigationReport)
def get_irrigation_plan(
    farm_id: str,
    report_date: date = Query(default_factory=date.today),
    current_user: CurrentUser = Depends(get_current_user)
):
    farm = get_farm_by_id(farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    if farm.get("user_id") != current_user.user_id:
        raise HTTPException(status_code=403, detail="You do not have access to this farm")

    return _generate_plan_for_date(farm_id, farm, report_date)


@router.get("/farm/{farm_id}/irrigation/bulk")
def get_irrigation_plan_bulk(
    farm_id: str,
    start_date: date = Query(...),
    end_date: date = Query(...),
    current_user: CurrentUser = Depends(get_current_user)
):
    if end_date < start_date:
        raise HTTPException(status_code=400, detail="end_date must be >= start_date")

    farm = get_farm_by_id(farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    if farm.get("user_id") != current_user.user_id:
        raise HTTPException(status_code=403, detail="You do not have access to this farm")

    results = []
    current_date = start_date
    while current_date <= end_date:
        try:
            report = _generate_plan_for_date(farm_id, farm, current_date)
            results.append({"date": current_date.isoformat(), "status": "success", "report": report})
        except Exception as e:
            results.append({"date": current_date.isoformat(), "status": "error", "detail": str(e)})
        current_date += timedelta(days=1)

    return {
        "farm_id": farm_id,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "total": len(results),
        "results": results
    }


@router.post("/farm/{farm_id}/irrigation/report", status_code=201)
def create_irrigation_report(
    farm_id: str,
    report: IrrigationReport,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Store a complete irrigation report for a farm owned by the caller."""
    if report.farm_id != farm_id:
        raise HTTPException(
            status_code=400,
            detail="The farm_id in the request body must match the URL farm_id.",
        )

    farm = get_farm_by_id(farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    if farm.get("user_id") != current_user.user_id:
        raise HTTPException(status_code=403, detail="You do not have access to this farm")

    existing_report = get_irrigation_report_by_date(
        farm_id,
        report.report_date,
    )
    if existing_report:
        return {
            "message": "Irrigation report already exists for this date",
            "report_id": existing_report["_id"],
        }

    # inject crop_day into saved document when possible
    report_dict = report.model_dump()
    planting = farm.get("planting_date")
    if planting:
        try:
            if isinstance(planting, str):
                planting_dt = datetime.fromisoformat(planting)
            else:
                planting_dt = planting
            planting_date_only = planting_dt.date()
            report_date_obj = date.fromisoformat(report.report_date)
            days = (report_date_obj - planting_date_only).days + 1
            report_dict["crop_day"] = max(1, days)
        except Exception:
            pass
    # compute crop_stage before saving
    try:
        crop_name_for_report = report_dict.get("crop_name") or farm.get("crop_name")
        report_dict["crop_stage"] = compute_crop_stage(crop_name_for_report, report_dict.get("crop_day"))
    except Exception:
        pass

    result = save_irrigation_report(report_dict)
    return {
        "message": "Irrigation report created successfully",
        "report_id": str(result.inserted_id),
        "crop_day": report_dict.get("crop_day"),
        "crop_stage": report_dict.get("crop_stage"),
    }

@router.post("/predict")
def predict_crop(data: CropInput, current_user: CurrentUser = Depends(get_current_user)):

    sample = pd.DataFrame({
        "N": [data.N],
        "P": [data.P],
        "K": [data.K],
        "temperature": [data.temperature],
        "humidity": [data.humidity],
        "ph": [data.ph],
        "rainfall": [data.rainfall]
    })

    prediction = model.predict(sample)
    crop = encoder.inverse_transform(prediction)
    recommended_crop = remap_recommended_crop(crop[0])

    prediction_data = {
        "user_id": current_user.user_id,
        "phone": data.phone,
        "N": data.N,
        "P": data.P,
        "K": data.K,
        "temperature": data.temperature,
        "humidity": data.humidity,
        "ph": data.ph,
        "rainfall": data.rainfall,
        "recommended_crop": recommended_crop
    }

    save_prediction(prediction_data)

    return {"recommended_crop": recommended_crop}


@router.post("/register")
def register(data: UserRegister, current_user: CurrentUser = Depends(get_current_user)):
    if data.uid != current_user.user_id:
        raise HTTPException(status_code=403, detail="You can only register your own user ID")
    user = {
        "uid": data.uid,
        "phone": data.phone,
        "name": data.name,
        "created_at": str(date.today())
    }
    register_user(user)
    return {"message": "User registered successfully"}


@router.post("/auth/send-otp")
def send_otp(data: SendOTPRequest):
    otp = str(random.randint(100000, 999999))

    api_key = os.getenv("FAST2SMS_API_KEY")

    response = requests.post(
        "https://www.fast2sms.com/dev/bulkV2",
        headers={"authorization": api_key},
        json={
            "message": otp,
            "route": "q",
            "numbers": data.phone
        }
    )

    if response.status_code != 200 or not response.json().get("return"):
        raise HTTPException(status_code=500, detail="Failed to send OTP")

    store_otp(data.phone, otp)

    return {"success": True, "message": "OTP sent successfully"}


@router.post("/auth/verify-otp")
def check_otp(data: VerifyOTPRequest):
    result = verify_otp(data.phone, data.otp)

    if result == "not_found":
        raise HTTPException(status_code=404, detail="Phone number not found")
    if result == "expired":
        raise HTTPException(status_code=410, detail="OTP has expired")
    if result == "invalid":
        raise HTTPException(status_code=400, detail="Invalid OTP")

    user = connection.users_collection.find_one({"phone": data.phone})
    if not user or not user.get("uid"):
        raise HTTPException(status_code=404, detail="User not registered")

    user_id = str(user["_id"])
    connection.users_collection.update_one(
        {"_id": user["_id"]}, {"$set": {"last_login": datetime.utcnow()}}
    )

    return {
        "success": True,
        "message": "OTP verified successfully",
        "userId": user_id,
        "access_token": create_access_token(user_id),
        "token_type": "bearer",
    }


@router.get("/farm/{farm_id}/irrigation/reports")
def get_farm_irrigation_reports(
    farm_id: str,
    current_user: CurrentUser = Depends(get_current_user)
):
    farm = get_farm_by_id(farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    if farm.get("user_id") != current_user.user_id:
        raise HTTPException(status_code=403, detail="You do not have access to this farm")

    reports = get_irrigation_reports_by_farm(farm_id)
    return {"reports": reports}


@router.get("/farms")
def get_user_farms(current_user: CurrentUser = Depends(get_current_user)):
    farms = get_farms_by_user(current_user.user_id)
    return {"farms": farms}


@router.post("/farm")
def add_farm(data: Farm, current_user: CurrentUser = Depends(get_current_user)):
    farm = data.model_dump()
    farm["user_id"] = current_user.user_id
    result = create_farm(farm)
    return {"message": "Farm created successfully", "farm_id": str(result.inserted_id)}
