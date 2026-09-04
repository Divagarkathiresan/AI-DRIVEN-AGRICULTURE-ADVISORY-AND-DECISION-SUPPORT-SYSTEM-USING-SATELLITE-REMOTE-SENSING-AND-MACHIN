import joblib
import pandas as pd
from pathlib import Path

_saved = Path(__file__).resolve().parent.parent / "saved_models"

model = joblib.load(_saved / "crop_model.pkl")
encoder = joblib.load(_saved / "label_encoder.pkl")

_market_model = joblib.load(_saved / "market_price_model.joblib")
_market_encoders = joblib.load(_saved / "encoders.joblib")
_market_features = joblib.load(_saved / "features.joblib")


def predict_price(
    crop: str,
    market: str,
    variety: str,
    grade: str,
    min_price: float,
    max_price: float,
    price_lag_1: float,
    price_lag_7: float,
    price_lag_14: float,
    price_lag_30: float,
    price_rolling_7: float,
    price_rolling_14: float,
    price_rolling_30: float,
    prediction_date
) -> float:

    row = {
        "crop_encoded": _market_encoders["crop"].transform([crop])[0],
        "market_encoded": _market_encoders["market"].transform([market])[0],
        "variety_encoded": _market_encoders["variety"].transform([variety])[0],
        "grade_encoded": _market_encoders["grade"].transform([grade])[0],
        "year": prediction_date.year,
        "month": prediction_date.month,
        "day": prediction_date.day,
        "day_of_week": prediction_date.weekday(),
        "day_of_year": prediction_date.timetuple().tm_yday,
        "price_lag_1": price_lag_1,
        "price_lag_7": price_lag_7,
        "price_lag_14": price_lag_14,
        "price_lag_30": price_lag_30,
        "price_rolling_7": price_rolling_7,
        "price_rolling_14": price_rolling_14,
        "price_rolling_30": price_rolling_30,
        "price_change_7": price_lag_1 - price_lag_7,
        "price_change_14": price_lag_1 - price_lag_14,
        "min_price": min_price,
        "max_price": max_price,
    }

    X = pd.DataFrame([row])[_market_features]
    return round(float(_market_model.predict(X)[0]), 2)