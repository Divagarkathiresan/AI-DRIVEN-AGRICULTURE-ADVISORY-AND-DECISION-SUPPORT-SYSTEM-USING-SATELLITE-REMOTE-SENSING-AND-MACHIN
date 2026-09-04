import os
import joblib
import numpy as np
import pandas as pd

from xgboost import XGBRegressor
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score
)


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DATA_PATH = os.path.join(
    BASE_DIR,
    "datasets",
    "coimbatore_market_prices.csv"
)

MODEL_DIR = os.path.join(
    BASE_DIR,
    "models"
)

MODEL_PATH = os.path.join(
    MODEL_DIR,
    "market_price_model.joblib"
)

ENCODER_PATH = os.path.join(
    MODEL_DIR,
    "encoders.joblib"
)

FEATURE_PATH = os.path.join(
    MODEL_DIR,
    "features.joblib"
)


# ============================================================
# LOAD DATA
# ============================================================

print("Loading dataset...")

df = pd.read_csv(DATA_PATH)

print(f"Total records: {len(df)}")


# ============================================================
# BASIC CLEANING
# ============================================================

df["date"] = pd.to_datetime(df["date"])

df = df.sort_values(
    ["crop", "date"]
).reset_index(drop=True)

df = df.drop_duplicates(
    subset=["date", "crop", "market"]
).reset_index(drop=True)


# ============================================================
# CREATE TIME FEATURES
# ============================================================

df["year"] = df["date"].dt.year

df["month"] = df["date"].dt.month

df["day"] = df["date"].dt.day

df["day_of_week"] = df["date"].dt.dayofweek

df["day_of_year"] = df["date"].dt.dayofyear


# ============================================================
# PRICE LAG FEATURES
# ============================================================

df["price_lag_1"] = (
    df.groupby("crop")["modal_price"]
    .shift(1)
)

df["price_lag_7"] = (
    df.groupby("crop")["modal_price"]
    .shift(7)
)

df["price_lag_14"] = (
    df.groupby("crop")["modal_price"]
    .shift(14)
)

df["price_lag_30"] = (
    df.groupby("crop")["modal_price"]
    .shift(30)
)


# ============================================================
# ROLLING PRICE FEATURES
# ============================================================

df["price_rolling_7"] = (
    df.groupby("crop")["modal_price"]
    .transform(
        lambda x: x.shift(1).rolling(7).mean()
    )
)

df["price_rolling_14"] = (
    df.groupby("crop")["modal_price"]
    .transform(
        lambda x: x.shift(1).rolling(14).mean()
    )
)

df["price_rolling_30"] = (
    df.groupby("crop")["modal_price"]
    .transform(
        lambda x: x.shift(1).rolling(30).mean()
    )
)


# ============================================================
# PRICE TREND
# ============================================================

df["price_change_7"] = (
    df["price_lag_1"] -
    df["price_lag_7"]
)

df["price_change_14"] = (
    df["price_lag_1"] -
    df["price_lag_14"]
)


# ============================================================
# ENCODE CATEGORICAL FEATURES
# ============================================================

crop_encoder = LabelEncoder()
market_encoder = LabelEncoder()
variety_encoder = LabelEncoder()
grade_encoder = LabelEncoder()

df["crop_encoded"] = (
    crop_encoder.fit_transform(df["crop"])
)

df["market_encoded"] = (
    market_encoder.fit_transform(df["market"])
)

df["variety_encoded"] = (
    variety_encoder.fit_transform(df["variety"])
)

df["grade_encoded"] = (
    grade_encoder.fit_transform(df["grade"])
)


# ============================================================
# REMOVE ROWS WITH MISSING LAG VALUES
# ============================================================

df = df.dropna().reset_index(drop=True)

print(f"Records after feature engineering: {len(df)}")


# ============================================================
# FEATURES
# ============================================================

features = [
    "crop_encoded",
    "market_encoded",
    "variety_encoded",
    "grade_encoded",

    "year",
    "month",
    "day",
    "day_of_week",
    "day_of_year",

    "price_lag_1",
    "price_lag_7",
    "price_lag_14",
    "price_lag_30",

    "price_rolling_7",
    "price_rolling_14",
    "price_rolling_30",

    "price_change_7",
    "price_change_14",

    "min_price",
    "max_price"
]

target = "modal_price"

X = df[features]
y = df[target]


# ============================================================
# CHRONOLOGICAL TRAIN / TEST SPLIT
# ============================================================

split_index = int(len(df) * 0.8)

X_train = X.iloc[:split_index]
X_test = X.iloc[split_index:]
y_train = y.iloc[:split_index]
y_test = y.iloc[split_index:]

print("\nTraining records:", len(X_train))
print("Testing records:", len(X_test))


# ============================================================
# XGBOOST MODEL
# ============================================================

model = XGBRegressor(
    n_estimators=500,
    learning_rate=0.03,
    max_depth=6,
    min_child_weight=3,
    subsample=0.85,
    colsample_bytree=0.85,
    objective="reg:squarederror",
    eval_metric="mae",
    random_state=42,
    n_jobs=-1
)


# ============================================================
# TRAIN
# ============================================================

print("\nTraining model...")

model.fit(
    X_train,
    y_train,
    eval_set=[(X_test, y_test)],
    verbose=False
)

print("Training completed.")


# ============================================================
# PREDICTION & EVALUATION
# ============================================================

y_pred = model.predict(X_test)

mae = mean_absolute_error(y_test, y_pred)
rmse = np.sqrt(mean_squared_error(y_test, y_pred))
r2 = r2_score(y_test, y_pred)

print("\n==============================")
print("MODEL PERFORMANCE")
print("==============================")
print(f"MAE  : ₹{mae:.2f}")
print(f"RMSE : ₹{rmse:.2f}")
print(f"R²   : {r2:.4f}")


# ============================================================
# SAVE MODEL + ENCODERS + FEATURES
# ============================================================

os.makedirs(MODEL_DIR, exist_ok=True)

joblib.dump(model, MODEL_PATH)

encoders = {
    "crop": crop_encoder,
    "market": market_encoder,
    "variety": variety_encoder,
    "grade": grade_encoder
}

joblib.dump(encoders, ENCODER_PATH)
joblib.dump(features, FEATURE_PATH)

print("\n==============================")
print("FILES SAVED")
print("==============================")
print(MODEL_PATH)
print(ENCODER_PATH)
print(FEATURE_PATH)
