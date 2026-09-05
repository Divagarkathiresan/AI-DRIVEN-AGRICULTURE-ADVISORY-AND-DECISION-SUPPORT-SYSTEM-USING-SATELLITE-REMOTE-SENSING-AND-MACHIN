import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, usePathname } from "expo-router";
import { Home, Leaf, MessageCircle, Plus, Store } from "lucide-react-native";

import { palette, shadow } from "@/theme/agriculture";

const tabs = [
  { label: "Home", path: "/homepage", Icon: Home },
  { label: "Advisory", path: "/predict-crop", Icon: MessageCircle },
  { label: "", path: "/add-farm", Icon: Plus, center: true },
  { label: "Farms", path: "/farms", Icon: Store },
  { label: "Disease", path: "/disease-prediction", Icon: Leaf },
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
    left: 12,
    right: 12,
    bottom: 12,
    minHeight: 68,
    borderRadius: 34,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.78)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    ...shadow,
  },
  item: {
    width: 62,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  label: {
    color: palette.caption,
    fontSize: 10,
    fontWeight: "700",
  },
  centerItem: {
    width: 66,
    alignItems: "center",
    justifyContent: "center",
  },
  plusButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -24,
    ...shadow,
  },
  iconBadge: {
    width: 30,
    height: 30,
    borderRadius: 12,
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
