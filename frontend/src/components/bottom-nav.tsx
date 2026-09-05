import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, usePathname } from "expo-router";
import { Home, Leaf, MessageCircle, Plus, Store, UserRound } from "lucide-react-native";

import { palette, radius, shadow } from "@/theme/agriculture";

const tabs = [
  { label: "Home", path: "/homepage", Icon: Home },
  { label: "Advisory", path: "/predict-crop", Icon: MessageCircle },
  { label: "", path: "/add-farm", Icon: Plus, center: true },
  { label: "Farms", path: "/farms", Icon: Store },
  { label: "Disease", path: "/disease-prediction", Icon: Leaf },
  { label: "Profile", path: "/profile", Icon: UserRound },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <View style={styles.nav}>
      {tabs.map(({ label, path, Icon, center }) => {
        const active = pathname === path || (path === "/farms" && pathname === "/add-farm");
        const iconColor = active ? palette.primary : palette.caption;
        if (center) {
          return (
            <Pressable key={path} style={styles.centerItem} onPress={() => router.replace(path as never)} accessibilityLabel="Add farm">
              <View style={styles.plusButton}>
                <Icon size={27} color="#FFFFFF" strokeWidth={2.8} />
              </View>
            </Pressable>
          );
        }
        return (
          <Pressable key={path} style={styles.item} onPress={() => router.replace(path as never)}>
            <View style={[styles.iconBadge, active && styles.activeIconBadge]}>
              <Icon size={18} color={iconColor} strokeWidth={2.4} />
            </View>
            <Text style={[styles.label, active && styles.activeLabel]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 12,
    minHeight: 72,
    borderRadius: radius.xl,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.78)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 8,
    ...shadow,
  },
  item: {
    flex: 1,
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  label: {
    color: palette.caption,
    fontSize: 10,
    fontWeight: "700",
  },
  centerItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  plusButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -28,
    ...shadow,
  },
  iconBadge: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: "rgba(240, 244, 236, 0.58)",
    alignItems: "center",
    justifyContent: "center",
  },
  activeIconBadge: {
    backgroundColor: "rgba(234, 246, 231, 0.84)",
  },
  activeLabel: {
    color: palette.primary,
  },
});
