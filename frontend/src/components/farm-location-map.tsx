import React, { useEffect, useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, type LatLng, type Region } from "react-native-maps";

import { palette } from "@/theme/agriculture";
import type { FarmLocation } from "@/types/domain";

const DEFAULT_LOCATION: FarmLocation = {
  latitude: 11.0168,
  longitude: 76.9558,
};

const MAP_DELTA = 0.035;

const toRegion = (location: FarmLocation): Region => ({
  ...location,
  latitudeDelta: MAP_DELTA,
  longitudeDelta: MAP_DELTA,
});

const isUsableLocation = (location: FarmLocation) =>
  Number.isFinite(location.latitude) &&
  Number.isFinite(location.longitude) &&
  !(location.latitude === 0 && location.longitude === 0);

type FarmLocationMapProps = {
  location: FarmLocation;
  onSelect: (location: FarmLocation) => void;
};

/** A tappable map that keeps the farm's saved coordinates in sync with its pin. */
export function FarmLocationMap({ location, onSelect }: FarmLocationMapProps) {
  const mapRef = useRef<MapView | null>(null);
  const selectedLocation = useMemo(
    () => (isUsableLocation(location) ? location : DEFAULT_LOCATION),
    [location],
  );

  useEffect(() => {
    if (isUsableLocation(location)) {
      mapRef.current?.animateToRegion(toRegion(location), 400);
    }
  }, [location]);

  const selectPoint = ({ latitude, longitude }: LatLng) => {
    onSelect({
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
    });
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={toRegion(selectedLocation)}
        onPress={(event) => selectPoint(event.nativeEvent.coordinate)}
        showsUserLocation
        showsMyLocationButton
      >
        {isUsableLocation(location) ? <Marker coordinate={location} title="Farm location" /> : null}
      </MapView>
      <View pointerEvents="none" style={styles.tip}>
        <Text style={styles.tipText}>Tap anywhere on the map to place your farm pin</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 220,
    overflow: "hidden",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CFE4CE",
  },
  map: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  tip: {
    position: "absolute",
    right: 10,
    bottom: 10,
    maxWidth: 230,
    borderRadius: 10,
    backgroundColor: "rgba(24, 60, 36, 0.88)",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  tipText: {
    color: palette.card,
    fontSize: 11,
    fontWeight: "700",
  },
});
