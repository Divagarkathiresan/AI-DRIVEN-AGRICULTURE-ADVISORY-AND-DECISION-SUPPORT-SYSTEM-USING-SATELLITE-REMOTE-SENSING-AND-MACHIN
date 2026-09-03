import requests
from datetime import date, datetime


class WeatherService:

    FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
    ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"

    @staticmethod
    def get_weather(latitude: float, longitude: float, report_date: str = None):

        today = date.today()

        if report_date:
            target = datetime.strptime(report_date, "%Y-%m-%d").date()
        else:
            target = today

        try:

            if target < today:
                # ----------------------------
                # Historical weather
                # ----------------------------
                params = {
                    "latitude": latitude,
                    "longitude": longitude,
                    "start_date": report_date,
                    "end_date": report_date,
                    "daily": [
                        "temperature_2m_mean",
                        "relative_humidity_2m_mean",
                        "precipitation_sum",
                        "wind_speed_10m_max",
                        "precipitation_probability_max"
                    ],
                    "timezone": "auto"
                }

                response = requests.get(
                    WeatherService.ARCHIVE_URL,
                    params=params,
                    timeout=10
                )
                response.raise_for_status()
                daily = response.json()["daily"]

                return {
                    "temperature": daily["temperature_2m_mean"][0],
                    "humidity": daily["relative_humidity_2m_mean"][0],
                    "rainfall": daily["precipitation_sum"][0],
                    "wind_speed": daily["wind_speed_10m_max"][0],
                    "rain_probability": daily.get("precipitation_probability_max", [None])[0]
                }

            else:
                # ----------------------------
                # Forecast / today's weather
                # ----------------------------
                forecast_days = max(1, (target - today).days + 1)

                params = {
                    "latitude": latitude,
                    "longitude": longitude,
                    "current": [
                        "temperature_2m",
                        "relative_humidity_2m",
                        "rain",
                        "wind_speed_10m"
                    ],
                    "daily": [
                        "temperature_2m_mean",
                        "relative_humidity_2m_mean",
                        "precipitation_sum",
                        "wind_speed_10m_max",
                        "precipitation_probability_max"
                    ],
                    "forecast_days": forecast_days,
                    "timezone": "auto"
                }

                response = requests.get(
                    WeatherService.FORECAST_URL,
                    params=params,
                    timeout=10
                )
                response.raise_for_status()
                data = response.json()

                daily = data["daily"]
                dates = daily["time"]
                idx = dates.index(target.isoformat()) if target.isoformat() in dates else 0

                return {
                    "temperature": daily["temperature_2m_mean"][idx],
                    "humidity": daily["relative_humidity_2m_mean"][idx],
                    "rainfall": daily["precipitation_sum"][idx],
                    "wind_speed": daily["wind_speed_10m_max"][idx],
                    "rain_probability": daily["precipitation_probability_max"][idx]
                }

        except Exception as e:

            print("Weather API Error:", e)

            return {
                "temperature": None,
                "humidity": None,
                "rainfall": None,
                "wind_speed": None,
                "rain_probability": None
            }


# ============================================================
# TEST
# ============================================================

if __name__ == "__main__":

    latitude = 13.0827
    longitude = 80.2707

    # Test 1: Past date (historical)
    past_date = "2025-09-03"
    print(f"Historical weather for {past_date}:")
    print(WeatherService.get_weather(latitude, longitude, past_date))

    # # Test 2: Today
    # today = date.today().isoformat()
    # print(f"\nToday's weather ({today}):")
    # print(WeatherService.get_weather(latitude, longitude, today))

    # # Test 3: Future date (forecast)
    # future_date = "2025-08-05"
    # print(f"\nForecast weather for {future_date}:")
    # print(WeatherService.get_weather(latitude, longitude, future_date))
