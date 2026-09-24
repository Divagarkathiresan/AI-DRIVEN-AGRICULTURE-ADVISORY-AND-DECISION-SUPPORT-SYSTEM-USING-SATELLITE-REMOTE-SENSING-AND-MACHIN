import React from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { MapPressEvent, Marker } from "react-native-maps";

import { palette } from "@/theme/agriculture";
import type { FarmMapProps } from "./farm-map";

export function FarmMap({ location, onLocationChange }: FarmMapProps) {
  const handleMapPress = (event: MapPressEvent) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    onLocationChange(latitude, longitude);
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        region={{
          latitude: location.latitude || 20.5937,
          longitude: location.longitude || 78.9629,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}
        onPress={handleMapPress}
        showsUserLocation
        showsMyLocationButton
      >
        {location.latitude !== 0 || location.longitude !== 0 ? (
          <Marker
            coordinate={location}
            draggable
            onDragEnd={(event) => {
              const { latitude, longitude } = event.nativeEvent.coordinate;
              onLocationChange(latitude, longitude);
            }}
            title="Farm location"
          />
        ) : null}
      </MapView>
      <Text style={styles.hint}>Tap the map to place your farm, or drag the marker to adjust it.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DDEEDD",
  },
  map: {
    height: 220,
    width: "100%",
  },
  hint: {
    color: palette.muted,
    backgroundColor: palette.card,
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
});