import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";

import { palette } from "@/theme/agriculture";
import type { FarmLocation } from "@/types/domain";

const DEFAULT_LOCATION: FarmLocation = { latitude: 11.0168, longitude: 76.9558 };
const MAP_DELTA = 0.035;

const isUsableLocation = (location: FarmLocation) =>
  Number.isFinite(location.latitude) &&
  Number.isFinite(location.longitude) &&
  !(location.latitude === 0 && location.longitude === 0);

type FarmLocationMapProps = {
  location: FarmLocation;
  onSelect: (location: FarmLocation) => void;
};

type IframeProps = {
  src: string;
  title: string;
  style: React.CSSProperties;
};

// react-native-web does not provide a map implementation; an OpenStreetMap embed
// gives web users the same no-account-required location picker.
const Iframe = "iframe" as unknown as React.ComponentType<IframeProps>;

export function FarmLocationMap({ location, onSelect }: FarmLocationMapProps) {
  const center = isUsableLocation(location) ? location : DEFAULT_LOCATION;
  const [size, setSize] = React.useState({ width: 1, height: 220 });

  const mapUrl = useMemo(() => {
    const minLongitude = center.longitude - MAP_DELTA;
    const maxLongitude = center.longitude + MAP_DELTA;
    const minLatitude = center.latitude - MAP_DELTA / 2;
    const maxLatitude = center.latitude + MAP_DELTA / 2;
    const marker = isUsableLocation(location) ? `&marker=${location.latitude}%2C${location.longitude}` : "";
    return `https://www.openstreetmap.org/export/embed.html?bbox=${minLongitude}%2C${minLatitude}%2C${maxLongitude}%2C${maxLatitude}&layer=mapnik${marker}`;
  }, [center, location]);

  const onLayout = ({ nativeEvent }: LayoutChangeEvent) => setSize(nativeEvent.layout);

  const selectPoint = (event: { nativeEvent: { locationX: number; locationY: number } }) => {
    const longitude = center.longitude + ((event.nativeEvent.locationX / size.width) - 0.5) * MAP_DELTA * 2;
    const latitude = center.latitude - ((event.nativeEvent.locationY / size.height) - 0.5) * MAP_DELTA;
    onSelect({ latitude: Number(latitude.toFixed(6)), longitude: Number(longitude.toFixed(6)) });
  };

  return (
    <View style={styles.container} onLayout={onLayout}>
      <Iframe src={mapUrl} title="Farm location map" style={styles.iframe} />
      <Pressable
        style={styles.touchLayer}
        onPress={selectPoint}
        accessibilityRole="button"
        accessibilityLabel="Select farm location on map"
      />
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
  iframe: {
    width: "100%",
    height: "100%",
    borderWidth: 0,
  },
  touchLayer: {
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
