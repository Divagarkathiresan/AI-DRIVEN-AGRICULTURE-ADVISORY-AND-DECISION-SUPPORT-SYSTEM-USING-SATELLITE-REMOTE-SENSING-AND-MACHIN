from . import connection
from datetime import datetime, timedelta

def save_prediction(data):
    return connection.predictions_collection.insert_one(data)

def register_user(data):
    return connection.users_collection.insert_one(data)

def store_otp(phone: str, otp: str):
    expires_at = datetime.utcnow() + timedelta(minutes=5)
    connection.otp_collection.replace_one(
        {"phone": phone},
        {"phone": phone, "otp": otp, "expires_at": expires_at.isoformat()},
        upsert=True
    )

def verify_otp(phone: str, otp: str):
    record = connection.otp_collection.find_one({"phone": phone})
    if not record:
        return "not_found"
    if datetime.utcnow() > datetime.fromisoformat(record["expires_at"]):
        return "expired"
    if record["otp"] != otp:
        return "invalid"
    return "success"

def create_farm(data: dict):
    return connection.farms_collection.insert_one(data)

def get_farm_by_id(farm_id: str):
    from bson import ObjectId
    return connection.farms_collection.find_one({"_id": ObjectId(farm_id)})

def get_farms_by_user(user_id: str):
    farms = connection.farms_collection.find({"user_id": user_id})
    result = []
    for farm in farms:
        farm["_id"] = str(farm["_id"])
        result.append(farm)
    return result

def save_satellite_report(data: dict):
    return connection.satellite_reports_collection.insert_one(data)

def save_irrigation_report(data: dict):
    return connection.irrigation_reports_collection.insert_one(data)

def get_irrigation_reports_by_farm(farm_id: str):
    reports = list(connection.irrigation_reports_collection.find({"farm_id": farm_id}))
    for report in reports:
        report["_id"] = str(report["_id"])
    reports.sort(key=lambda report: (report.get("crop_day") is None, report.get("crop_day") if report.get("crop_day") is not None else 0))
    return reports

def get_irrigation_report_by_date(farm_id: str, date: str):
    report = connection.irrigation_reports_collection.find_one({
        "farm_id": farm_id,
        "report_date": date
    })
    if report:
        report["_id"] = str(report["_id"])
    return report


def get_market_price_history(crop: str, location: str, variety: str):
    records = list(connection.market_prices_collection.find(
        {"crop": crop, "location": location, "variety": variety},
        {
            "_id": 0,
            "date": 1,
            "market": 1,
            "variety": 1,
            "grade": 1,
            "modal_price": 1,
            "min_price": 1,
            "max_price": 1
        }
    ).sort("date", 1))
    return records


def save_carbon_report(report: dict):
    # PyMongo adds ``_id`` to the inserted dictionary.  Insert a copy so the
    # route can return the original JSON-safe report without an ObjectId.
    document = {**report, "created_at": datetime.utcnow()}
    return connection.carbon_reports_collection.insert_one(document)


def get_carbon_reports_by_farm(farm_id: str):
    return list(
        connection.carbon_reports_collection.find({"farm_id": farm_id}, {"_id": 0}).sort(
            "created_at", -1
        )
    )


def get_carbon_report_by_farm(farm_id: str):
    return connection.carbon_reports_collection.find_one(
        {"farm_id": farm_id}, {"_id": 0}
    )
