import React, { useEffect } from "react";
import { router } from "expo-router";
import { ArrowLeft, BellRing, Sprout } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppScreen } from "@/components/screen";
import { Card } from "@/components/ui";
import { useAppStore } from "@/store/appStore";
import { palette } from "@/theme/agriculture";

export function NotificationsScreen() {
  const notifications = useAppStore((state) => state.notifications);
  const markNotificationsRead = useAppStore((state) => state.markNotificationsRead);

  useEffect(() => {
    markNotificationsRead();
  }, [markNotificationsRead]);

  return (
    <AppScreen withNav>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Back">
          <ArrowLeft size={20} color={palette.text} />
        </Pressable>
        <View>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>Farm alerts and reminders</Text>
        </View>
      </View>
      {notifications.length ? notifications.map((notification) => (
        <Card key={notification.id} style={styles.notification}>
          <View style={styles.icon}><BellRing size={19} color={palette.primary} /></View>
          <View style={styles.copy}>
            <Text style={styles.notificationTitle}>{notification.title}</Text>
            <Text style={styles.message}>{notification.message}</Text>
          </View>
        </Card>
      )) : (
        <Card style={styles.empty}>
          <Sprout size={30} color={palette.primary} />
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.message}>Harvest alerts will appear here when a crop reaches its harvest window.</Text>
        </Card>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  title: { color: palette.text, fontSize: 24, fontWeight: "900" },
  subtitle: { color: palette.muted, fontWeight: "700", marginTop: 2 },
  notification: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  icon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: palette.lightGreen },
  copy: { flex: 1, gap: 4 },
  notificationTitle: { color: palette.text, fontSize: 15, fontWeight: "900" },
  message: { color: palette.muted, fontSize: 13, fontWeight: "600", lineHeight: 19 },
  empty: { alignItems: "center", gap: 10, paddingVertical: 34 },
  emptyTitle: { color: palette.text, fontSize: 17, fontWeight: "900" },
});
