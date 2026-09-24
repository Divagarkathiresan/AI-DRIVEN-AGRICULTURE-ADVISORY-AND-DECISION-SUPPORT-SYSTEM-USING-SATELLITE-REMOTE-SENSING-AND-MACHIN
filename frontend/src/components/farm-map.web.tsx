import Constants from "expo-constants";
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { palette } from "@/theme/agriculture";
import type { FarmMapProps } from "./farm-map";

type GoogleMap = {
  panTo: (location: { lat: number; lng: number }) => void;
  addListener: (event: string, callback: (event: { latLng?: { lat: () => number; lng: () => number } }) => void) => unknown;
};

type GoogleMarker = {
  setPosition: (location: { lat: number; lng: number }) => void;
};

type GoogleMapsApi = {
  maps: {
    Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap;
    Marker: new (options: Record<string, unknown>) => GoogleMarker;
    event: { removeListener: (listener: unknown) => void };
  };
};

declare global {
  interface Window {
    google?: GoogleMapsApi;
  }
}

let googleMapsPromise: Promise<GoogleMapsApi> | null = null;

function loadGoogleMaps(apiKey: string): Promise<GoogleMapsApi> {
  if (window.google?.maps) return Promise.resolve(window.google);
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.onload = () => window.google?.maps ? resolve(window.google) : reject(new Error("Google Maps did not load."));
    script.onerror = () => reject(new Error("Unable to load Google Maps."));
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

const defaultLocation = { latitude: 20.5937, longitude: 78.9629 };

export function FarmMap({ location, onLocationChange }: FarmMapProps) {
  const mapElementId = React.useId();
  const map = useRef<GoogleMap | null>(null);
  const marker = useRef<GoogleMarker | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const apiKey = Constants.expoConfig?.extra?.googleMapsWebApiKey as string | undefined;
  const hasSelectedLocation = Number.isFinite(location.latitude) && Number.isFinite(location.longitude) && (location.latitude !== 0 || location.longitude !== 0);

  useEffect(() => {
    if (!apiKey) return;

    let disposed = false;
    let clickListener: unknown;

    loadGoogleMaps(apiKey)
      .then((google) => {
        const element = document.getElementById(mapElementId);
        if (disposed || !element) return;

        map.current = new google.maps.Map(element, {
          center: { lat: defaultLocation.latitude, lng: defaultLocation.longitude },
          zoom: 5,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        setMapReady(true);

        clickListener = map.current.addListener("click", (event) => {
          const latitude = event.latLng?.lat();
          const longitude = event.latLng?.lng();
          if (latitude !== undefined && longitude !== undefined) onLocationChange(latitude, longitude);
        });
      })
      .catch((loadError: Error) => !disposed && setError(loadError.message));

    return () => {
      disposed = true;
      if (clickListener && window.google?.maps) window.google.maps.event.removeListener(clickListener);
    };
  }, [apiKey, mapElementId, onLocationChange]);

  useEffect(() => {
    if (!mapReady || !hasSelectedLocation || !map.current || !window.google?.maps) return;
    const position = { lat: location.latitude, lng: location.longitude };
    if (marker.current) {
      marker.current.setPosition(position);
    } else {
      marker.current = new window.google.maps.Marker({ map: map.current, position, draggable: true, title: "Farm location" });
    }
    map.current.panTo(position);
  }, [hasSelectedLocation, location, mapReady]);

  return (
    <View style={styles.container}>
      <View nativeID={mapElementId} style={styles.map} />
      <Text style={styles.text}>{!apiKey ? "Add GOOGLE_MAPS_WEB_API_KEY to .env.local to enable the web map." : error || "Click the map to place your farm location."}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    borderRadius: 16,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: "#DDEEDD",
  },
  map: {
    height: 220,
    width: "100%",
  },
  text: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700",
    backgroundColor: palette.card,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
});
