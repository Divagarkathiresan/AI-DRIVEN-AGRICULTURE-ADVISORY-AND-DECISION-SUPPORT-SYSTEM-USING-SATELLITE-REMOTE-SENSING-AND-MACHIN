export type FarmMapLocation = {
  latitude: number;
  longitude: number;
};

export type FarmMapProps = {
  location: FarmMapLocation;
  onLocationChange: (latitude: number, longitude: number) => void;
};

export { FarmMap } from "./farm-map.native";