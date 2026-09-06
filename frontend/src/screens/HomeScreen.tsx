import React, { useEffect } from "react";
import { router } from "expo-router";
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { CloudSun, Leaf, Menu, MessageCircle, Sprout, Store, TestTube2, UserRound } from "lucide-react-native";

import { AppScreen } from "@/components/screen";
import { Card, SectionHeader } from "@/components/ui";
import { Illustration } from "@/components/illustrations";
import { useAppStore } from "@/store/appStore";
import { palette } from "@/theme/agriculture";

export function HomeScreen() {
  const auth = useAppStore((state) => state.auth);
  const farms = useAppStore((state) => state.farms);
  const currentFarm = farms[0];

  useEffect(() => {
    if (Platform.OS === "web") return;
    const timeout = setTimeout(() => {
      Alert.alert("Enable Location", "Please enable location access so Smart Agriculture AI can personalize your farm dashboard.", [
        { text: "Not Now", style: "cancel" },
        { text: "Open Settings", onPress: () => Linking.openSettings().catch(() => undefined) },
      ]);
    }, 500);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <AppScreen withNav>
      <View style={styles.topBar}>
        {/* <Pressable style={styles.iconButton} accessibilityLabel="Open menu">
          <Menu size={21} color={palette.text} />
        </Pressable> */}
        <Pressable style={styles.iconButton} accessibilityLabel="Profile" onPress={() => router.push("/profile" as never)}>
          <UserRound size={20} color={palette.text} />
        </Pressable>
      </View>

      <View>
        <Text style={styles.greeting}>Hello, {auth.name || "Farmer"} 👋</Text>
        <Text style={styles.caption}>Here&apos;s what&apos;s happening in your farm today.</Text>
      </View>

      <Card style={styles.weatherCard}>
        <View style={styles.weatherTop}>
          <View>
            <View style={styles.weatherIconRow}>
              <CloudSun size={28} color="#FFFFFF" />
              <Text style={styles.temperature}>28°C</Text>
            </View>
            <Text style={styles.condition}>Partly Cloudy</Text>
          </View>
          <Illustration name="otp-landscape" width={104} height={82} />
        </View>
        <View style={styles.weatherGrid}>
          <WeatherItem label="Humidity" value="65%" />
          <WeatherItem label="Rainfall" value="12 mm" />
          <WeatherItem label="Wind" value="10 km/h" />
        </View>
      </Card>

      <SectionHeader title="Quick Actions" />
      <View style={styles.quickGrid}>
        <QuickAction title="Crop Recommendation" icon={<Sprout size={22} color={palette.primary} />} onPress={() => router.push("/predict-crop" as never)} />
        <QuickAction title="AI Advisory" icon={<MessageCircle size={22} color={palette.primary} />} onPress={() => router.push("/predict-crop" as never)} />
        <QuickAction title="Farms" icon={<Store size={22} color={palette.primary} />} onPress={() => router.push("/farms" as never)} />
        <QuickAction title="Disease Prediction" icon={<Leaf size={22} color={palette.primary} />} onPress={() => router.push("/disease-prediction" as never)} />
      </View>

      <SectionHeader title="Farm Overview" />
      <View style={styles.overviewGrid}>
        <Card style={styles.overviewCard}>
          <View style={styles.overviewIcon}><Leaf size={19} color={palette.primary} /></View>
          <Text style={styles.cardLabel}>Current Crop</Text>
          <Text style={styles.cardTitle}>{currentFarm?.crop_name || "No crop added"}</Text>
          <Text style={styles.cardMeta}>Stage: {currentFarm?.planting_date ? "Growing" : "Planning"}</Text>
          <Text style={styles.cardMeta}>Days remaining: {currentFarm ? "Monitoring" : "--"}</Text>
        </Card>
        <Card style={styles.overviewCard}>
          <View style={styles.overviewIcon}><TestTube2 size={19} color={palette.primary} /></View>
          <Text style={styles.cardLabel}>Soil Health</Text>
          <Text style={styles.cardTitle}>{currentFarm?.soil_type || "Balanced"}</Text>
          <StatusBadge label="Good" tone="success" />
          <Text style={styles.cardMeta}>pH and NPK tracked via recommendations</Text>
        </Card>
      </View>
    </AppScreen>
  );
}

function WeatherItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.weatherItem}>
      <Text style={styles.weatherValue}>{value}</Text>
      <Text style={styles.weatherLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({ title, icon, onPress }: { title: string; icon: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable style={styles.quickCard} onPress={onPress}>
      <View style={styles.quickIcon}>{icon}</View>
      <Text style={styles.quickTitle}>{title}</Text>
    </Pressable>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: "success" | "warning" | "danger" }) {
  const color = tone === "success" ? palette.success : tone === "warning" ? palette.warning : palette.danger;
  return (
    <View style={[styles.badge, { backgroundColor: `${color}18` }]}>
      <View style={[styles.badgeDot, { backgroundColor: color }]} />
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center",
    justifyContent: "center",
  },
  greeting: {
    color: palette.text,
    fontSize: 26,
    fontWeight: "900",
  },
  caption: {
    color: palette.muted,
    marginTop: 5,
    fontWeight: "700",
  },
  weatherCard: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
    gap: 18,
  },
  weatherTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  weatherIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  temperature: {
    color: "#FFFFFF",
    fontSize: 38,
    fontWeight: "900",
  },
  condition: {
    color: "#EAF7E8",
    fontSize: 15,
    fontWeight: "800",
  },
  weatherGrid: {
    flexDirection: "row",
    gap: 10,
  },
  weatherItem: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 18,
    padding: 12,
  },
  weatherValue: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  weatherLabel: {
    color: "#EAF7E8",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 3,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  quickCard: {
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 118,
    borderRadius: 24,
    backgroundColor: palette.lightGreen,
    borderWidth: 1,
    borderColor: "#DDEEDD",
    padding: 15,
    justifyContent: "space-between",
  },
  quickIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  quickTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "900",
  },
  overviewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  overviewCard: {
    flex: 1,
    minWidth: 155,
    gap: 8,
  },
  overviewIcon: {
    width: 38,
    height: 38,
    borderRadius: 15,
    backgroundColor: palette.lightGreen,
    alignItems: "center",
    justifyContent: "center",
  },
  cardLabel: {
    color: palette.caption,
    fontSize: 12,
    fontWeight: "800",
  },
  cardTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  cardMeta: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  badgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "900",
  },
});
