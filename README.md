To run the frontend use these commands in terminal :
```bash
cd frontend
nvm use 20
npx expo start
npx expo start --dev-client --lan --clear


# Use this command alone
cd /Users/sanjana/Desktop/Projects/Smart-Agriculture-Advisory-using-AI-main/frontend
nvm use 20
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
export GOOGLE_MAPS_API_KEY="your-google-maps-android-key"

npx expo run:android
```

The map requires a Google Maps API key with Maps SDK for Android enabled in Google Cloud. Restrict the key to the Android package `com.sanjana.smartagricultureadvisory` and the signing certificate used for the build. The key is read during the Expo native build and is not stored in the repository.

To run the backend use these commands in the terminal :
MacOS / Linux
```bash
cd backend
python3 run.py
```

```bash
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

To run the disease prediction :
MacOS / Linux
```bash
source disease_detection_env/bin/activate
python3 -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```





cd frontend
nvm use 20
export GOOGLE_MAPS_API_KEY="your-real-google-maps-key"

npx expo prebuild
npx expo run:android