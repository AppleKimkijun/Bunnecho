import trafficLightConfig from "./window-traffic-lights.json";

export type TrafficLightColors = {
  close: string;
  minimize: string;
  maximize: string;
};

export type TrafficLightWindowKey = "camera" | "particle" | "frame";

export type WindowTrafficLightConfig = Record<
  TrafficLightWindowKey,
  TrafficLightColors
>;

const DEFAULT_COLORS: TrafficLightColors = {
  close: "#ff5f57",
  minimize: "#febc2e",
  maximize: "#28c840",
};

const CONFIG = trafficLightConfig as WindowTrafficLightConfig;

export function getTrafficLightColors(
  windowId: TrafficLightWindowKey,
): TrafficLightColors {
  return CONFIG[windowId] ?? DEFAULT_COLORS;
}
