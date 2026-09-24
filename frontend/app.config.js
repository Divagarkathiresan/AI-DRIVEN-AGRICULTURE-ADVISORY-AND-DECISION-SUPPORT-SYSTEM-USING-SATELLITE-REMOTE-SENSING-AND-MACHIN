const appJson = require("./app.json");

const androidGoogleMapsApiKey =
  process.env.GOOGLE_MAPS_ANDROID_API_KEY ||
  process.env.GOOGLE_MAPS_API_KEY;
const webGoogleMapsApiKey =
  process.env.GOOGLE_MAPS_WEB_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

module.exports = {
  ...appJson,
  expo: {
    ...appJson.expo,
    extra: {
      ...appJson.expo.extra,
      // Web map keys are intentionally public; restrict this key by website
      // referrer in Google Cloud Console.
      googleMapsWebApiKey: webGoogleMapsApiKey,
    },
    plugins: [
      ...appJson.expo.plugins,
      ...(androidGoogleMapsApiKey
        ? [["react-native-maps", { androidGoogleMapsApiKey }]]
        : []),
    ],
  },
};
