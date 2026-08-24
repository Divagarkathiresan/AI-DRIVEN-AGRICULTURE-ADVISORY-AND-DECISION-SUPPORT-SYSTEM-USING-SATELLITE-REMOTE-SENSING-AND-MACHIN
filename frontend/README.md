# Smart Agriculture Advisory Frontend

This directory contains the React Native/Expo frontend. This guide documents the implemented behavior and API contract required to rebuild the same application in Flutter.

## Product scope

The app provides phone OTP login and registration, a home dashboard, GPS-based farm creation, AI crop recommendation, farm list/details, irrigation and crop-health reports, satellite/NDVI images, crop lifecycle filtering, profile, and logout. It is portrait-oriented, light-themed, and uses a custom floating bottom navigation bar.

## Stack and commands

- Expo SDK 57, React Native 0.86, React 19.2, TypeScript 6.
- Expo Router for typed file-based navigation.
- Axios for HTTP, TanStack React Query for server requests, Zustand for app state.
- React Hook Form and Zod for forms/validation.
- AsyncStorage for persisted state and auth; Expo Location for GPS.
- Lucide React Native, React Native SVG, Expo Image, and Expo animations.
- Node `>=20.19.4`; `.nvmrc` selects `22.23.1`.

```bash
npm install
npm start
npm run android
npm run ios
npm run web
npm run lint
```

## Complete frontend map

### Root and native configuration

- `package.json`, `package-lock.json`: dependencies and scripts.
- `app.json`: app identity, portrait orientation, icons, splash, Firebase files, native plugins, and web output.
- `tsconfig.json`: TypeScript settings and `@/*` source alias.
- `eslint.config.js`: Expo ESLint configuration; `.nvmrc`: Node version.
- `.vscode/`: workspace settings/extensions; `.claude/settings.json`: local Claude settings.
- `google-services.json`, `GoogleService-Info.plist`: Firebase native configuration. Firebase is configured but not called by frontend source.
- `android/`: generated Android/Gradle project. Flutter replaces this with generated Flutter platform folders.
- `scripts/reset-project.js`: Expo starter reset script, not runtime behavior.
- `firebase-debug.log`, `errorReadme.md`, `LICENSE`: generated notes, local notes, and license.

### `src/app`: route wrappers

Each file forwards an Expo Router route to a screen in `src/screens`.

- `_layout.tsx`: QueryClient, toast provider, light theme, headerless root stack.
- `index.tsx`: `/`; onboarding/splash.
- `login.tsx`: `/login`; login.
- `register.tsx`: `/register`; registration.
- `otp.tsx`: `/otp`; OTP verification.
- `homepage.tsx`: `/homepage`; dashboard.
- `farms.tsx`: `/farms`; farm list.
- `add-farm.tsx`: `/add-farm`; farm creation.
- `farm-details.tsx`: `/farm-details`; expects `farmId`.
- `daily-report.tsx`: `/daily-report`; expects `farmId`, `cropDay`, optional `reportFilter`.
- `predict-crop.tsx`: `/predict-crop`; crop recommendation.
- `profile.tsx`: `/profile`; profile.
- `explore.tsx`: `/explore`; redirects to `/homepage`, not a separate product view.

### `src/screens`: behavior owners

- `SplashScreen.tsx`: four onboarding slides, skip/next, auth-session check, login/home transition.
- `AuthScreens.tsx`: login, registration, and OTP forms. Phone is digits-only, max 10 digits, then prefixed with `+91`.
- `HomeScreen.tsx`: greeting, static weather card, quick actions, first cached farm, bottom navigation.
- `FarmListScreen.tsx`: `GET /farms`, loading skeleton, refresh, retry, empty state, selection.
- `AddFarmScreen.tsx`: GPS permission/location, farm form, prediction handoff, validation, `POST /farm`.
- `CropRecommendationScreen.tsx`: seven numeric fields, `POST /predict`, confidence/result UI, accept/reject handoff.
- `FarmDetailsScreen.tsx`: current irrigation report plus history, farm metadata, health chart, lifecycle filter, daily-report navigation.
- `DailyReportScreen.tsx`: one report by crop day, all report sections, satellite/NDVI images, zoom, unavailable values.
- `ProfileScreen.tsx`: profile, farm/advisory links, visual-only edit row, logout.

### `src/services`

- `api/client.ts`: Axios base URL, JSON headers, 12-second timeout, Bearer token injection, retry policy, and 401 logout redirect.
- `api/index.ts`: all API calls and response normalization. See [API contract](#api-contract).
- `authStorage.ts`: AsyncStorage key `smart-agriculture-auth`, session read/write/delete, token lookup.

### `src/store`, `src/types`, and `src/constants`

- `store/appStore.ts`: persisted Zustand state: auth, farm draft, prediction result, farms, selected farm, and actions.
- `types/domain.ts`: `AuthSession`, `Farm`, `FarmFormValues`, `FarmLocation`, `FarmArea`, `CropPredictionInput`, `CropPredictionResult`, nullable `IrrigationReport`.
- `constants/cropLifecycle.ts`: tomato, potato, and pepper 120-day stage definitions and lookup helpers.
- `constants/theme.ts`: older Expo theme constants.

### `src/theme`, `src/hooks`, and web styling

- `theme/agriculture.ts`: active agriculture palette, radii, shadows, and tokens.
- `hooks/use-theme.ts`: theme color helper.
- `hooks/use-color-scheme.ts`: native color-scheme hook.
- `hooks/use-color-scheme.web.ts`: web color-scheme implementation.
- `global.css`: web global styles.

### `src/components`

- `ui.tsx`: `AppButton`, `FieldInput`, `SectionHeader`, `Card`, `AnimatedCard`, `BrandMark`, loaders, illustration wrapper.
- `screen.tsx`: safe area, scrolling, centered max width 760 px, bottom-nav padding.
- `bottom-nav.tsx`: live Home, Advisory, Add Farm, Farms, Profile navigation using route replacement.
- `illustrations.tsx`: inline SVG illustrations used by product screens.
- `toast.tsx`: toast provider and success/error messages.
- `themed-text.tsx`, `themed-view.tsx`: older theme helpers.
- `animated-icon.tsx`, `animated-icon.web.tsx`, `animated-icon.module.css`: Expo starter animated icon.
- `app-tabs.tsx`, `app-tabs.web.tsx`: Expo starter tabs; live app uses `bottom-nav.tsx`.
- `external-link.tsx`, `hint-row.tsx`, `web-badge.tsx`, `ui/collapsible.tsx`: starter/supporting components without core API behavior.

## Navigation

```text
/ -> onboarding -> /login
/ -> /homepage when an auth session exists
/login -> /otp?phone=+91XXXXXXXXXX
/register -> /otp?phone=+91XXXXXXXXXX&name=...
/otp -> /homepage after verification and optional registration
/homepage -> /predict-crop, /farms, /profile, /add-farm
/farms -> /farm-details?farmId=...
/add-farm -> /predict-crop -> /add-farm
/farm-details -> /daily-report?farmId=...&cropDay=...&reportFilter=...
```

The five-item bottom navigation is present on home, advisory, add-farm, farms, and profile. Preserve these route parameters in Flutter.

## API contract

### Common client behavior

`EXPO_PUBLIC_API_BASE_URL` takes priority. Defaults are web `http://127.0.0.1:8000`, detected Expo host on native port `8000`, Android emulator `http://10.0.2.2:8000`, then `http://127.0.0.1:8000`.

Every request sends `Content-Type: application/json` and, when available, `Authorization: Bearer <accessToken>`. Timeout is 12 seconds. Network and HTTP 5xx failures retry once after 500 ms; 4xx responses do not retry. HTTP 401 clears auth and routes to login. Error text uses `detail`, then `message`, then the client error. For Flutter, use Dio interceptors and `flutter_secure_storage` for tokens; the current app uses ordinary AsyncStorage.

### Authentication

#### `POST /auth/send-otp`

Request: `{ "phone": "+911234567890" }`

Response used: `{ "success": true, "message": "OTP sent successfully" }`. The test phone `+911234567890` bypasses sending and verifies with OTP `123456`.

#### `POST /auth/verify-otp`

Request: `{ "phone": "+911234567890", "otp": "123456" }`

Expected response:

```json
{
  "success": true,
  "message": "OTP verified successfully",
  "userId": "user-id",
  "access_token": "token"
}
```

Frontend mapping: `access_token` becomes `accessToken`; both `userId` and `accessToken` are required for success.

#### `POST /register`

Request: `{ "uid": "user-id", "name": "Farmer Name", "phone": "+911234567890" }`. `uid` defaults to phone. Only the response message is used.

### Crop and farms

#### `POST /predict`

Request:

```json
{
  "phone": "+911234567890",
  "N": 90,
  "P": 42,
  "K": 43,
  "temperature": 20.8,
  "humidity": 82,
  "ph": 6.5,
  "rainfall": 202
}
```

Required response: `recommended_crop`. Optional fields: `confidence`, `suitable_soil`, `suitable_temperature`, `suitable_rainfall`, and `reasons` (string array). The frontend supplies defaults for missing optional values.

#### `POST /farm`

Request:

```json
{
  "user_id": "user-id",
  "farm_name": "North Field",
  "crop_name": "tomato",
  "area": { "value": 10, "unit": "acre" },
  "location": { "latitude": 12.9716, "longitude": 77.5946 },
  "soil_type": null,
  "irrigation_type": null,
  "planting_date": null,
  "description": null
}
```

Expected response: `{ "farm_id": "id" }`. The frontend creates a local farm with both `id` and `_id`, and status `Active`.

#### `GET /farms`

Expected response: `{ "farms": [ ... ] }`. A farm has `farm_name`, `crop_name`, `area`, and `location`; its identifier may be `id` or `_id`. The frontend normalizes both and defaults status to `Active`.

### Irrigation

- `GET /farm/{farmId}/irrigation`: one `IrrigationReport`.
- `GET /farm/{farmId}/irrigation/reports`: array, `{ "reports": [] }`, or `{ "irrigation_reports": [] }`; sorted by numeric `crop_day`.

An `IrrigationReport` has `farm_id`, `report_date`, optional `crop_day`, `crop_stage`, `crop_name`, `location`, and nullable sections:

```text
weather: temperature, humidity, rainfall, wind_speed, rain_probability
satellite: average_ndvi, health_score, healthy_area, status,
           satellite_image_url, ndvi_image_url, recommendation
soil_moisture: soil_moisture_score, soil_moisture_level
water_requirement: crop, farm_area, unit, water_requirement_mm_per_day,
                   water_required_liters
recommendation: irrigation_status, recommendation, best_irrigation_time,
                soil_moisture_level, soil_moisture_score,
                estimated_water_required_liters, estimated_water_saved_liters,
                generated_at
```

The UI renders null values as `--`. Relative satellite/NDVI paths are prefixed with the API base URL; literal `satellite_url` is unavailable. A single-report error containing `no satellite image` produces an unavailable report instead of an error screen.

## State and persistence

Use Riverpod or Bloc equivalents for:

- `auth`: `isAuthenticated`, `phone`, optional `name`, `userId`, `accessToken`.
- `addFarmDraft`: farm form with nested area and location.
- `predictionResult`: last recommendation or null.
- `farms`: local farm cache.
- `selectedFarm`: selected farm or null.

Successful OTP saves auth and copies the user id into the draft. Accepting a recommendation writes `recommended_crop` into the draft. Successful farm creation prepends the farm, resets the draft, shows success briefly, and routes to farms. Logout clears auth, prediction, farms, and selected farm. Current storage keys are `smart-agriculture-auth` and `smart-agriculture-state`; auth is separate from the Zustand-persisted cache.

## Forms and platform behavior

- Login/register: name minimum length 2; phone exactly 10 digits, sent with `+91`.
- OTP: exactly 6 digits; test phone auto-submits `123456`. Resend text is static `Resend OTP in 00:30`; there is no timer/action.
- Prediction: N/P/K/rainfall nonnegative; humidity 0-100; pH 0-14; temperature unrestricted.
- Add farm: name minimum length 2, crop required, positive area, unit `acre` or `hectare`, and required location.
- Location starts on add-farm mount. Web uses browser geolocation. Native requests foreground permission, tries high accuracy three times with two-second gaps, then uses last-known location.
- Manual coordinates are intentionally unavailable; location failure replaces the form with Retry.
- The Unit input is currently free text although validation accepts only `acre` or `hectare`; Flutter should use a dropdown/segmented control.
- Home weather is static: 28 C, Partly Cloudy, 65% humidity, 12 mm rainfall, 10 km/h wind. No weather API is called.
- Health scores are clamped to 0-100. Reports show five at a time. Daily images zoom to 3x.

## Crop lifecycle rules

Only tomato, potato, and pepper have lifecycle metadata. Each totals 120 days with inclusive stage ranges in `src/constants/cropLifecycle.ts`. Unknown crops have no filter or expected stage. These rules are display-only and never sent to the backend.

## Assets

- `assets/illustrations/`: welcome, login, OTP, crop recommendation, advisory, empty farm, irrigation, soil health, satellite NDVI, crop lifecycle, and market SVGs.
- `assets/icons/`: crop, weather, irrigation, soil, profile, pest-control, market, advisory, satellite, and fertilizer SVGs.
- `assets/avatars/farmer.svg`: farmer avatar.
- `assets/images/paddy-login.png`, `paddy-register.png`, `logo-glow.png`: app artwork.
- `assets/images/icon.png`, `splash-icon.png`, Android icon variants, `favicon.png`: branding.
- `assets/images/tabIcons/`: legacy home/explore PNG icons.
- `assets/images/react-logo*`, `expo-logo.png`, Expo badges, `tutorial-web.png`: Expo starter assets.
- `assets/crops/`: currently empty.
- `src/components/illustrations.tsx` draws live illustrations inline; Flutter can load the matching SVG files with `flutter_svg`.

Suggested Flutter packages: `go_router`, `dio`, `flutter_riverpod` or `bloc`, `flutter_secure_storage`, `shared_preferences`, `geolocator`, `flutter_svg`, `cached_network_image`, and `fl_chart`.

## Flutter rebuild checklist

1. Recreate routes and persistent five-item navigation.
2. Add environment API URL and Dio auth/retry/401 interceptors.
3. Model nullable irrigation report sections.
4. Preserve OTP, `+91` normalization, and test account behavior where appropriate.
5. Store auth securely and draft/cache separately.
6. Recreate GPS permission, retries, last-known fallback, and no-manual-coordinate behavior.
7. Recreate prediction-to-add-farm draft handoff.
8. Recreate report sorting, lifecycle filtering, health chart, relative image URLs, unavailable satellite state, and zoom.
9. Load existing SVG/PNG assets and match palette, rounded cards, animations, and 760 px web width where needed.
10. Replace localhost HTTP with a reachable HTTPS backend for device builds.
