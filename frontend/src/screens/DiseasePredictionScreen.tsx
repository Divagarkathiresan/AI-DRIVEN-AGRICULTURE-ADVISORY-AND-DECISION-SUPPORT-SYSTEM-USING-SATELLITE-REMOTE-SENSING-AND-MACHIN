import React, { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { useMutation } from "@tanstack/react-query";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { AlertTriangle, Camera, CheckCircle2, ImagePlus, ShieldAlert, Stethoscope } from "lucide-react-native";

import { AppScreen } from "@/components/screen";
import { AppButton, Card, RotatingSquareLoader, SectionHeader } from "@/components/ui";
import { useToast } from "@/components/toast";
import { DISEASE_API_BASE_URL, predictDisease, type DiseasePredictionResult } from "@/services/api";
import { palette, radius } from "@/theme/agriculture";

type SelectedImage = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export function DiseasePredictionScreen() {
  const toast = useToast();
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [result, setResult] = useState<DiseasePredictionResult | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      if (!selectedImage) {
        throw new Error("Select a leaf image first.");
      }
      return predictDisease({ ...selectedImage, includeExplanation: true });
    },
    onSuccess: (data) => setResult(data),
    onError: (error: Error) => toast.show(error.message || `Disease API did not respond at ${DISEASE_API_BASE_URL}.`, "error"),
  });

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.show("Photo library permission is needed to choose a leaf image.", "error");
      return;
    }

    const response = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.9,
    });

    if (response.canceled || !response.assets[0]) {
      return;
    }

    const asset = response.assets[0];
    setSelectedImage({
      uri: asset.uri,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
    });
    setResult(null);
  };

  const confidence = Math.round((result?.confidence ?? result?.risk_assessment?.confidence ?? 0) * 100);
  const riskLevel = result?.risk_level || result?.risk_assessment?.risk_level;
  const baseRisk = result?.risk_assessment?.base_risk;
  const recommendations = result?.risk_assessment?.recommendations || [];
  const explanationImage = result?.explanation?.explanation_image;

  return (
    <AppScreen withNav>
      <SectionHeader title="Disease Prediction" caption="Upload a crop leaf image and review disease risk, symptoms, and treatment guidance." />

      <Card style={styles.uploadCard}>
        <Pressable style={styles.imagePicker} onPress={pickImage}>
          {selectedImage ? (
            <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} resizeMode="cover" />
          ) : (
            <View style={styles.emptyPreview}>
              <ImagePlus size={34} color={palette.primary} strokeWidth={2.2} />
              <Text style={styles.emptyTitle}>Select Leaf Image</Text>
              <Text style={styles.emptyText}>Choose a clear image from your device</Text>
            </View>
          )}
        </Pressable>

        <View style={styles.uploadActions}>
          <AppButton title={selectedImage ? "Change Image" : "Upload Image"} variant="secondary" onPress={pickImage} icon={<Camera size={18} color={palette.primary} />} style={styles.actionButton} />
          <AppButton title="Predict Disease" loading={mutation.isPending} onPress={() => mutation.mutate()} icon={<Stethoscope size={18} color="#FFFFFF" />} style={styles.actionButton} />
        </View>
      </Card>

      {mutation.isPending ? (
        <Card style={styles.loadingCard}>
          <RotatingSquareLoader />
          <Text style={styles.loadingText}>Analyzing leaf health</Text>
        </Card>
      ) : null}

      {result ? (
        <Card style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <View style={[styles.riskIcon, riskLevel === "High" ? styles.highRisk : riskLevel === "Medium" ? styles.mediumRisk : styles.lowRisk]}>
              {riskLevel === "High" ? <ShieldAlert size={22} color="#FFFFFF" /> : riskLevel === "Medium" ? <AlertTriangle size={22} color="#FFFFFF" /> : <CheckCircle2 size={22} color="#FFFFFF" />}
            </View>
            <View style={styles.resultTitleWrap}>
              <Text style={styles.resultLabel}>Predicted Disease</Text>
              <Text style={styles.diseaseName}>{result.disease || result.predicted_class || "Unknown"}</Text>
            </View>
          </View>

          <View style={styles.metricsGrid}>
            <Metric label="Crop" value={result.crop || "Unknown"} />
            <Metric label="Confidence" value={confidence ? `${confidence}%` : "N/A"} />
            <Metric label="Risk Level" value={riskLevel || "N/A"} tone={riskLevel} />
            <Metric label="Base Risk" value={baseRisk || "N/A"} tone={baseRisk} />
          </View>

          {explanationImage ? (
            <View style={styles.explanationWrap}>
              <Text style={styles.blockTitle}>Visual Explanation</Text>
              <Image source={{ uri: `data:image/jpeg;base64,${explanationImage}` }} style={styles.explanationImage} resizeMode="cover" />
            </View>
          ) : null}

          <InfoBlock title="Description" text={result.disease_info?.description} />
          <ListBlock title="Symptoms" items={result.disease_info?.symptoms} />
          <ListBlock title="Solutions" items={result.disease_info?.solutions} />
          <ListBlock title="Prevention" items={result.disease_info?.prevention} />
          <ListBlock title="Recommendations" items={recommendations} highlight />
        </Card>
      ) : null}
    </AppScreen>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const toneStyle = tone === "High" ? styles.metricDanger : tone === "Medium" ? styles.metricWarning : tone === "Low" ? styles.metricSuccess : undefined;
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, toneStyle]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function InfoBlock({ title, text }: { title: string; text?: string }) {
  if (!text) return null;
  return (
    <View style={styles.infoBlock}>
      <Text style={styles.blockTitle}>{title}</Text>
      <Text style={styles.paragraph}>{text}</Text>
    </View>
  );
}

function ListBlock({ title, items, highlight = false }: { title: string; items?: string[]; highlight?: boolean }) {
  if (!items?.length) return null;
  return (
    <View style={styles.infoBlock}>
      <Text style={styles.blockTitle}>{title}</Text>
      <View style={styles.list}>
        {items.map((item, index) => (
          <View key={`${title}-${index}-${item}`} style={[styles.listItem, highlight && styles.highlightItem]}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.listText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  uploadCard: {
    gap: 16,
  },
  imagePicker: {
    minHeight: 240,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.mint,
  },
  previewImage: {
    width: "100%",
    height: 260,
  },
  emptyPreview: {
    minHeight: 240,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 22,
  },
  emptyTitle: {
    color: palette.text,
    fontSize: 20,
    fontWeight: "900",
  },
  emptyText: {
    color: palette.muted,
    fontWeight: "700",
    textAlign: "center",
  },
  uploadActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    minWidth: 150,
  },
  loadingCard: {
    minHeight: 170,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },
  loadingText: {
    color: palette.muted,
    fontWeight: "800",
  },
  resultCard: {
    gap: 18,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  riskIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  highRisk: {
    backgroundColor: palette.danger,
  },
  mediumRisk: {
    backgroundColor: palette.warning,
  },
  lowRisk: {
    backgroundColor: palette.success,
  },
  resultTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  resultLabel: {
    color: palette.secondary,
    fontWeight: "900",
    textTransform: "uppercase",
    fontSize: 12,
  },
  diseaseName: {
    color: palette.text,
    fontSize: 24,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metric: {
    flexGrow: 1,
    flexBasis: "47%",
    minHeight: 78,
    borderRadius: radius.md,
    backgroundColor: "rgba(234, 246, 231, 0.62)",
    borderWidth: 1,
    borderColor: "#D8ECD6",
    padding: 12,
    gap: 6,
  },
  metricLabel: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  metricValue: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "900",
  },
  metricDanger: {
    color: palette.danger,
  },
  metricWarning: {
    color: "#A46C00",
  },
  metricSuccess: {
    color: palette.success,
  },
  explanationWrap: {
    gap: 10,
  },
  explanationImage: {
    width: "100%",
    height: 230,
    borderRadius: radius.lg,
    backgroundColor: palette.mint,
  },
  infoBlock: {
    gap: 9,
  },
  blockTitle: {
    color: palette.text,
    fontSize: 17,
    fontWeight: "900",
  },
  paragraph: {
    color: palette.muted,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
  },
  list: {
    gap: 8,
  },
  listItem: {
    flexDirection: "row",
    gap: 9,
    borderRadius: radius.md,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: palette.border,
    padding: 12,
  },
  highlightItem: {
    backgroundColor: "#FFF8E7",
    borderColor: "#F4D999",
  },
  bullet: {
    color: palette.primary,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 22,
  },
  listText: {
    flex: 1,
    color: palette.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
  },
});
