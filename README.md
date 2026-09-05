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

npx expo run:android
```

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