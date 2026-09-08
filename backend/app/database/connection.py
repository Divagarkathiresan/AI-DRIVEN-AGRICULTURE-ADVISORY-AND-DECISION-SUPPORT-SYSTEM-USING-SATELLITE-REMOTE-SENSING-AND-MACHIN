import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
DATABASE_NAME = os.getenv("DATABASE_NAME")

client = None
users_collection = None 
predictions_collection = None
otp_collection = None
farms_collection = None
satellite_reports_collection = None
irrigation_reports_collection = None
market_prices_collection = None
carbon_reports_collection = None

def connect():
    global client, users_collection, predictions_collection, otp_collection, farms_collection, satellite_reports_collection, irrigation_reports_collection, market_prices_collection, carbon_reports_collection
    client = MongoClient(MONGODB_URI)
    db = client[DATABASE_NAME]
    users_collection = db["users"]
    predictions_collection = db["predictions"]
    otp_collection = db["otp_collection"]
    farms_collection = db["farms"]
    satellite_reports_collection = db["satellite_reports"]
    irrigation_reports_collection = db["irrigation_reports"]
    market_prices_collection = db["market_prices"]
    carbon_reports_collection = db["carbon_reports"]
    carbon_reports_collection.create_index("farm_id", unique=True)
