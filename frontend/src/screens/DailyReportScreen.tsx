import React, { useMemo } from "react";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, CloudRain, Droplets, Gauge, Satellite, Sprout, Thermometer, Timer, Wind } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppScreen } from "@/components/screen";
import { AppButton, Card, SectionHeader } from "@/components/ui";
import { getExpectedStageForDay } from "@/constants/cropLifecycle";
import { fetchFarmIrrigationReport, fetchFarmIrrigationReports } from "@/services/api";
import { API_BASE_URL } from "@/services/api/client";
import { useAppStore } from "@/store/appStore";
import { palette } from "@/theme/agriculture";
import type { IrrigationReport } from "@/types/domain";

const placeholder = "--";

export function DailyReportScreen() {
  const params = useLocalSearchParams<{ farmId?: string; cropDay?: string; reportDate?: string }>();
  const selectedFarm = useAppStore((state) => state.selectedFarm);
  const farmId = Array.isArray(params.farmId) ? params.farmId[0] : params.farmId;
  const cropDayParam = Array.isArray(params.cropDay) ? params.cropDay[0] : params.cropDay;
  const reportDate = Array.isArray(params.reportDate) ? params.reportDate[0] : params.reportDate;
  const reportFilter = Array.isArray((params as { reportFilter?: string | string[] }).reportFilter)
    ? (params as { reportFilter?: string[] }).reportFilter?.[0]
    : (params as { reportFilter?: string }).reportFilter;
  const cropDay = Number(cropDayParam);

  const { data = [], error, isLoading, refetch } = useQuery({
    queryKey: ["farm-irrigation-reports", farmId],
    queryFn: () => fetchFarmIrrigationReports(farmId || ""),
    enabled: Boolean(farmId),
    staleTime: 1000 * 60 * 5,
  });

  const listReport = useMemo(
    () => data.find((item) => item.crop_day === cropDay || (reportDate && item.report_date === reportDate)),
    [cropDay, data, reportDate],
  );

  const {
    data: directReport,
    error: directReportError,
    isLoading: directReportLoading,
    refetch: refetchDirectReport,
  } = useQuery({
    queryKey: ["farm-irrigation", farmId, reportDate || cropDay],
    queryFn: () => fetchFarmIrrigationReport(farmId || "", reportDate),
    enabled: Boolean(farmId) && !listReport,
  });

  const report = listReport || directReport;
  const loadingReport = isLoading || (!listReport && directReportLoading);
  const reportError = error || (!listReport ? directReportError : null);

  const goBack = () => {
    if (farmId) {
      router.replace({ pathname: "/farm-details" as never, params: { farmId, reportFilter, backToFarms: "true" } });
      return;
    }
    router.replace("/farms" as never);
  };

  if (!farmId || !Number.isFinite(cropDay)) {
    return (
      <AppScreen>
        <Header title="Daily Irrigation Report" subtitle="Report not found" onBack={goBack} />
        <Card style={styles.centerCard}>
          <Text style={styles.errorTitle}>Missing report details</Text>
          <AppButton title="Back to Farm Details" onPress={goBack} />
        </Card>
      </AppScreen>
    );
  }

  if (loadingReport) {
    return (
      <AppScreen>
        <Header title={`Day ${cropDay}`} subtitle="Loading daily report..." onBack={goBack} />
        <DailySkeleton />
      </AppScreen>
    );
  }

  if (reportError) {
    return (
      <AppScreen>
        <Header title={`Day ${cropDay}`} subtitle="Daily Irrigation Report" onBack={goBack} />
        <Card style={styles.centerCard}>
          <Text style={styles.errorTitle}>Unable to load irrigation report.</Text>
          <Text style={styles.muted}>Please try again.</Text>
          <AppButton title="Retry" onPress={() => {
            refetch();
            refetchDirectReport();
          }} />
        </Card>
      </AppScreen>
    );
  }

  if (!report) {
    return (
      <AppScreen>
        <Header title={`Day ${cropDay}`} subtitle="Daily Irrigation Report" onBack={goBack} />
        <Card style={styles.centerCard}>
          <Text style={styles.errorTitle}>No report available for this day.</Text>
          <Text style={styles.muted}>Only days returned by the backend can be displayed.</Text>
          <AppButton title="Back to Farm Details" onPress={goBack} />
        </Card>
      </AppScreen>
    );
  }

  const cropName = report.crop_name || selectedFarm?.crop_name || "";
  const expectedStage = getExpectedStageForDay(cropName, report.crop_day);
  const ndviUrl = getReportImageUrl(report, selectedFarm?.farm_name, "ndvi_image_url", "ndvi.png");

  return (
    <AppScreen>
      <Header title={`Day ${report.crop_day ?? cropDay}`} subtitle={formatDate(report.report_date)} onBack={goBack} />

      <Card style={styles.summaryCard}>
        <View style={styles.summaryIcon}>
          <Sprout size={22} color="#FFFFFF" />
        </View>
        <View style={styles.summaryText}>
          <Text style={styles.cropName}>{cropName || placeholder}</Text>
          <Text style={styles.stageText}>{report.crop_stage || expectedStage?.name || placeholder}</Text>
          <Text style={styles.muted}>Report Date: {formatDate(report.report_date)}</Text>
        </View>
      </Card>

      <RecommendationCard report={report} />

      <Card style={styles.card}>
        <SectionHeader title="Weather" />
        <View style={styles.grid}>
          <Metric icon={<Thermometer size={18} color={palette.danger} />} label="Temperature" value={formatUnit(report.weather?.temperature, "°C", false)} />
          <Metric icon={<Droplets size={18} color="#1E88E5" />} label="Humidity" value={formatUnit(report.weather?.humidity, "%", false)} />
          <Metric icon={<CloudRain size={18} color="#4569B0" />} label="Rainfall" value={formatUnit(report.weather?.rainfall, "mm")} />
          <Metric icon={<Wind size={18} color={palette.muted} />} label="Wind Speed" value={formatUnit(report.weather?.wind_speed, "km/h")} />
          <Metric icon={<CloudRain size={18} color={palette.primary} />} label="Rain Probability" value={formatUnit(report.weather?.rain_probability, "%", false)} />
        </View>
      </Card>

      <Card style={styles.card}>
        <SectionHeader title="Soil Moisture" />
        <ProgressMetric value={report.soil_moisture?.soil_moisture_score} label="Soil Moisture Score" />
        <Metric label="Soil Moisture Level" value={report.soil_moisture?.soil_moisture_level || placeholder} icon={<Droplets size={18} color="#1E88E5" />} />
      </Card>

      <Card style={styles.card}>
        <SectionHeader title="Water Requirement" />
        <View style={styles.grid}>
          <Metric label="Crop" value={report.water_requirement?.crop || cropName || placeholder} />
          <Metric label="Farm Area" value={formatArea(report.water_requirement?.farm_area, report.water_requirement?.unit)} />
          <Metric label="Water Requirement" value={formatUnit(report.water_requirement?.water_requirement_mm_per_day, "mm/day")} />
          <Metric label="Water Required" value={formatLiters(report.water_requirement?.water_required_liters)} />
        </View>
      </Card>

      <Card style={styles.card}>
        <SectionHeader title="Satellite & Crop Health" />
        <View style={styles.grid}>
          <Metric icon={<Gauge size={18} color={palette.primary} />} label="Average NDVI" value={formatNumber(report.satellite?.average_ndvi, 3)} />
          <Metric label="Health Score" value={formatNumber(report.satellite?.health_score, 0)} />
          <Metric label="Healthy Area" value={formatUnit(report.satellite?.healthy_area, "%", false)} />
          <Metric label="Status" value={report.satellite?.status || placeholder} />
        </View>
      </Card>

      <ImageCard title="NDVI Visualization" url={ndviUrl} placeholderText="NDVI image unavailable" />

      <Card style={styles.card}>
        <SectionHeader title="Crop Health Recommendation" />
        <Text style={styles.bodyText}>{report.satellite?.recommendation || placeholder}</Text>
      </Card>
    </AppScreen>
  );
}

function Header({ title, subtitle, onBack }: { title: string; subtitle: string; onBack: () => void }) {
  return (
    <View style={styles.headerRow}>
      <Pressable style={styles.backButton} onPress={onBack} accessibilityLabel="Back to farm details">
        <ArrowLeft size={20} color={palette.text} />
      </Pressable>
      <View style={styles.headerText}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function RecommendationCard({ report }: { report: IrrigationReport }) {
  const status = report.recommendation?.irrigation_status || placeholder;
  const color = getStatusColor(status);
  return (
    <Card style={[styles.recommendationCard, { borderColor: color, backgroundColor: `${color}14` }]}>
      <View style={styles.recommendationTop}>
        <Droplets size={22} color={color} />
        <Text style={[styles.recommendationLabel, { color }]}>Irrigation Recommendation</Text>
      </View>
      <Text style={styles.recommendationStatus}>{status}</Text>
      <Text style={styles.bodyText}>{report.recommendation?.recommendation || placeholder}</Text>
      <View style={styles.grid}>
        <Metric icon={<Timer size={18} color={color} />} label="Best Time" value={report.recommendation?.best_irrigation_time || placeholder} />
        <Metric label="Soil Moisture" value={`${report.recommendation?.soil_moisture_level || placeholder} · ${formatNumber(report.recommendation?.soil_moisture_score, 0)}`} />
        <Metric label="Estimated Water Required" value={formatLiters(report.recommendation?.estimated_water_required_liters)} />
        <Metric label="Estimated Water Saved" value={formatLiters(report.recommendation?.estimated_water_saved_liters)} />
      </View>
      <View style={styles.generatedRow}>
        <CalendarDays size={15} color={palette.muted} />
        <Text style={styles.muted}>Generated: {formatDateTime(report.recommendation?.generated_at)}</Text>
      </View>
    </Card>
  );
}

function ImageCard({ title, url, placeholderText }: { title: string; url: string; placeholderText: string }) {
  return (
    <Card style={styles.card}>
      <SectionHeader title={title} />
      {url ? (
        <ScrollView maximumZoomScale={3} minimumZoomScale={1} style={styles.imageZoom} contentContainerStyle={styles.imageZoomContent}>
          <Image source={{ uri: url }} style={styles.reportImage} contentFit="cover" />
        </ScrollView>
      ) : (
        <View style={styles.imagePlaceholder}>
          <Satellite size={28} color={palette.caption} />
          <Text style={styles.muted}>{placeholderText}</Text>
        </View>
      )}
    </Card>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <View style={styles.metric}>
      <View style={styles.metricIcon}>{icon}</View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={3}>{value}</Text>
    </View>
  );
}

function ProgressMetric({ label, value }: { label: string; value?: number | null }) {
  const progress = Math.max(0, Math.min(100, Number(value ?? 0)));
  const color = progress >= 65 ? palette.primary : progress >= 35 ? palette.warning : palette.danger;
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressTop}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.progressValue}>{Number.isFinite(value as number) ? formatNumber(progress, 0) : placeholder}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function DailySkeleton() {
  return (
    <View style={styles.skeletonStack}>
      {[0, 1, 2, 3].map((item) => (
        <Card key={item} style={styles.card}>
          <View style={[styles.skeleton, styles.skeletonTitle]} />
          <View style={[styles.skeleton, styles.skeletonLine]} />
          <View style={[styles.skeleton, styles.skeletonLineShort]} />
        </Card>
      ))}
    </View>
  );
}

const normalizeUrl = (raw?: string | null) => {
  if (!raw || raw === "satellite_url") return "";
  return raw.startsWith("http") ? raw : `${API_BASE_URL}${raw.startsWith("/") ? "" : "/"}${raw}`;
};

const getReportImageUrl = (
  report: IrrigationReport,
  farmName: string | undefined,
  field: "satellite_image_url" | "ndvi_image_url",
  fileName: "satellite.png" | "ndvi.png",
) => {
  const raw = report.satellite?.[field];
  if (raw && raw !== fileName) {
    return normalizeUrl(raw);
  }

  if (!farmName || !report.report_date) {
    return normalizeUrl(raw);
  }

  const safeFarmName = farmName.replace(/[^\w-]/g, "_");
  return `${API_BASE_URL}/output/ndvi_images/${safeFarmName}_${report.report_date}/${fileName}`;
};

const formatNumber = (value?: number | null, digits = 1) =>
  typeof value === "number" && Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits > 0 ? 0 : 0 }) : placeholder;

const formatUnit = (value?: number | null, unit = "", space = true) => {
  const formatted = formatNumber(value);
  if (formatted === placeholder) return placeholder;
  return `${formatted}${space ? " " : ""}${unit}`;
};

const formatLiters = (value?: number | null) => {
  const formatted = typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : placeholder;
  return formatted === placeholder ? placeholder : `${formatted} L`;
};

const formatArea = (value?: number | null, unit?: string | null) => {
  const formatted = formatNumber(value);
  return formatted === placeholder ? placeholder : `${formatted} ${unit || ""}`.trim();
};

const formatDate = (value?: string | null) => {
  if (!value) return placeholder;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "long", year: "numeric" });
};

const formatDateTime = (value?: string | null) => {
  if (!value) return placeholder;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const getStatusColor = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized.includes("postpone") || normalized.includes("delay") || normalized.includes("warning")) return palette.warning;
  if (normalized.includes("irrigate") || normalized.includes("now") || normalized.includes("required")) return palette.primary;
  if (normalized.includes("monitor") || normalized.includes("observe")) return "#2F80ED";
  return palette.primaryDark;
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: palette.text,
    fontSize: 24,
    fontWeight: "900",
  },
  subtitle: {
    color: palette.muted,
    marginTop: 2,
    fontWeight: "700",
  },
  card: {
    gap: 12,
  },
  centerCard: {
    gap: 12,
    alignItems: "center",
  },
  summaryCard: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  summaryIcon: {
    width: 52,
    height: 52,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryText: {
    flex: 1,
    gap: 3,
  },
  cropName: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  stageText: {
    color: "#EAF7E8",
    fontSize: 14,
    fontWeight: "900",
  },
  recommendationCard: {
    gap: 14,
  },
  recommendationTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  recommendationLabel: {
    fontSize: 14,
    fontWeight: "900",
  },
  recommendationStatus: {
    color: palette.text,
    fontSize: 26,
    fontWeight: "900",
  },
  bodyText: {
    color: palette.text,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "700",
  },
  muted: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metric: {
    flex: 1,
    minWidth: 138,
    minHeight: 88,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: palette.border,
    padding: 12,
    gap: 5,
  },
  metricIcon: {
    minHeight: 18,
  },
  metricLabel: {
    color: palette.caption,
    fontSize: 12,
    fontWeight: "800",
  },
  metricValue: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "900",
  },
  generatedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  progressWrap: {
    gap: 8,
  },
  progressTop: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressValue: {
    color: palette.text,
    fontWeight: "900",
  },
  progressTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: "#E4EFE1",
    overflow: "hidden",
  },
  progressFill: {
    height: 12,
    borderRadius: 999,
  },
  imageZoom: {
    height: 230,
    borderRadius: 18,
    backgroundColor: "#EDF4EA",
    minWidth: "100%",
  },
  imageZoomContent: {
    minHeight: 230,
  },
  reportImage: {
    width: "100%",
    height: 230,
    borderRadius: 18,
  },
  imagePlaceholder: {
    height: 190,
    borderRadius: 18,
    backgroundColor: "#EDF4EA",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  errorTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  skeletonStack: {
    gap: 14,
  },
  skeleton: {
    backgroundColor: "#E6EFE1",
    borderRadius: 10,
  },
  skeletonTitle: {
    width: "52%",
    height: 20,
  },
  skeletonLine: {
    width: "90%",
    height: 15,
  },
  skeletonLineShort: {
    width: "62%",
    height: 15,
  },
});
