import React, { useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, MapPin } from "lucide-react-native";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Line, Polyline, Text as SvgText } from "react-native-svg";

import { AppScreen } from "@/components/screen";
import { Illustration } from "@/components/illustrations";
import { AnimatedCard, AppButton, Card, SectionHeader } from "@/components/ui";
import { fetchFarmIrrigationReport, fetchFarmIrrigationReports } from "@/services/api";
import { useAppStore } from "@/store/appStore";
import { palette } from "@/theme/agriculture";
import { formatCropName, getCropLifecycle, getExpectedStageForDay } from "@/constants/cropLifecycle";
import type { IrrigationReport } from "@/types/domain";

const placeholder = "--";
const DAYS_PER_PAGE = 5;

type HealthPoint = {
  day?: number | null;
  date?: string | null;
  score: number;
};

export function FarmDetailsScreen() {
  const params = useLocalSearchParams<{ farmId?: string; backToFarms?: string }>();
  const selectedFarm = useAppStore((state) => state.selectedFarm);
  const farmId = Array.isArray(params.farmId) ? params.farmId[0] : params.farmId;
  const reportFilterParam = Array.isArray((params as { reportFilter?: string | string[] }).reportFilter)
    ? (params as { reportFilter?: string[] }).reportFilter?.[0]
    : (params as { reportFilter?: string }).reportFilter;
  const backToFarmsParam = Array.isArray(params.backToFarms) ? params.backToFarms[0] : params.backToFarms;
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["farm-irrigation", farmId],
    queryFn: () => fetchFarmIrrigationReport(farmId || ""),
    enabled: Boolean(farmId),
  });
  const {
    data: dailyReports = [],
    error: dailyReportsError,
    isLoading: dailyReportsLoading,
    refetch: refetchDailyReports,
  } = useQuery({
    queryKey: ["farm-irrigation-reports", farmId],
    queryFn: () => fetchFarmIrrigationReports(farmId || ""),
    enabled: Boolean(farmId),
    staleTime: 1000 * 60 * 5,
  });
  const [dailyPage, setDailyPage] = useState(0);

  const goBack = () => {
    if (backToFarmsParam === "true") {
      router.replace("/farms" as never);
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/farms" as never);
  };

  if (!farmId) {
    return (
      <AppScreen>
        <Text style={styles.title}>Farm not found</Text>
        <AppButton title="Back to Farms" onPress={() => router.replace("/farms" as never)} />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={goBack}>
          <ArrowLeft size={20} color={palette.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>Farm Details</Text>
          <Text style={styles.subtitle}>{selectedFarm?.farm_name || data?.crop_name || "Monitoring report"}</Text>
        </View>
      </View>
      

      {isLoading ? <DetailsSkeleton /> : error ? (
        <Card style={styles.centerCard}>
          <Text style={styles.errorTitle}>Unable to Load Report</Text>
          <Text style={styles.errorText}>{error.message || "Please try again in a moment."}</Text>
          <AppButton title="Retry" onPress={() => refetch()} />
        </Card>
      ) : (
        <>
          <AnimatedCard>
            <Card style={styles.card}>
              <SectionHeader title="Farm Details" />
              <InfoRow label="Farm Area" value={formatNumber(data?.water_requirement?.farm_area ?? selectedFarm?.area?.value)} />
              <InfoRow label="Farm Unit" value={data?.water_requirement?.unit || selectedFarm?.area?.unit || placeholder} />
              <InfoRow label="Crop Name" value={data?.crop_name || selectedFarm?.crop_name || placeholder} />
              <InfoRow label="Location" value={formatLocation(selectedFarm?.location, data?.location)} icon={<MapPin size={16} color={palette.primary} />} />
            </Card>
          </AnimatedCard>

          <AnimatedCard delay={360}>
            <CropHealthScoreChart reports={dailyReports} isLoading={dailyReportsLoading} />
          </AnimatedCard>

          <AnimatedCard delay={300}>
            <DailyReportsSection
              farmId={farmId}
              farmCrop={selectedFarm?.crop_name || data?.crop_name}
              reports={dailyReports}
              isLoading={dailyReportsLoading}
              error={dailyReportsError as Error | null}
              page={dailyPage}
              initialFilter={reportFilterParam}
              onPageChange={setDailyPage}
              onRetry={() => refetchDailyReports()}
            />
          </AnimatedCard>
        </>
      )}
    </AppScreen>
  );
}

function DailyReportsSection({
  farmId,
  farmCrop,
  reports,
  isLoading,
  error,
  page,
  initialFilter,
  onPageChange,
  onRetry,
}: {
  farmId: string;
  farmCrop?: string;
  reports: IrrigationReport[];
  isLoading: boolean;
  error: Error | null;
  page: number;
  initialFilter?: string;
  onPageChange: (page: number) => void;
  onRetry: () => void;
}) {
  const lifecycle = getCropLifecycle(farmCrop);
  const cropLabel = formatCropName(farmCrop);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState(initialFilter || "all");
  const fade = useMemo(() => new Animated.Value(1), []);
  const filterOptions = useMemo(() => {
    const stageOptions = lifecycle?.stages.map((stage) => ({ value: `stage:${stage.name}`, label: stage.name })) || [];
    return [{ value: "all", label: "All reports" }, ...stageOptions];
  }, [lifecycle]);
  const selectedOption = filterOptions.find((option) => option.value === selectedFilter) || filterOptions[0];
  const filteredReports = useMemo(() => {
    if (selectedFilter === "all") return reports;
    const stageName = selectedFilter.replace(/^stage:/, "");
    return reports.filter((report) => {
      const expectedStage = getExpectedStageForDay(farmCrop, report.crop_day);
      return report.crop_stage === stageName || expectedStage?.name === stageName;
    });
  }, [farmCrop, reports, selectedFilter]);
  const start = page * DAYS_PER_PAGE;
  const visibleReports = filteredReports.slice(start, start + DAYS_PER_PAGE);
  const maxPage = Math.max(0, Math.ceil(filteredReports.length / DAYS_PER_PAGE) - 1);
  const selectedDay = visibleReports[0]?.crop_day ?? null;

  useEffect(() => {
    if (page > maxPage) {
      onPageChange(maxPage);
    }
  }, [maxPage, onPageChange, page]);

  useEffect(() => {
    fade.setValue(0.65);
    Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [fade, selectedFilter]);

  const selectFilter = (value: string) => {
    setSelectedFilter(value);
    setFilterOpen(false);
    onPageChange(0);
  };

  const openReport = (report: IrrigationReport) => {
    if (typeof report.crop_day !== "number") return;
    router.push({ pathname: "/daily-report" as never, params: { farmId, cropDay: String(report.crop_day), reportFilter: selectedFilter } });
  };

  return (
    <Card style={styles.dailyCard}>
      <SectionHeader title="Daily Irrigation Reports" caption="Reports are loaded from the backend and shown five days at a time." />
      <View style={styles.lifecycleBox}>
        <View style={styles.lifecycleHeader}>
          <View>
            <Text style={styles.lifecycleEyebrow}>Crop Lifecycle</Text>
            <Text style={styles.lifecycleTitle}>{cropLabel}</Text>
          </View>
          <Pressable style={styles.filterButton} onPress={() => setFilterOpen((value) => !value)} accessibilityLabel="Select report filter">
            <Text style={styles.filterButtonText} numberOfLines={1}>{selectedOption.label}</Text>
            <ChevronDown size={18} color={palette.primary} />
          </Pressable>
        </View>
        {filterOpen ? (
          <View style={styles.filterMenu}>
            {filterOptions.map((option) => {
              const active = option.value === selectedFilter;
              return (
                <Pressable key={option.value} style={[styles.filterOption, active && styles.activeFilterOption]} onPress={() => selectFilter(option.value)}>
                  <Text style={[styles.filterOptionText, active && styles.activeFilterOptionText]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {isLoading ? (
        <View style={styles.dailyLoading}>
          <View style={styles.dailySkeleton} />
          <Text style={styles.dailyMuted}>Loading daily reports...</Text>
        </View>
      ) : error ? (
        <View style={styles.dailyError}>
          <Text style={styles.errorTitle}>Unable to load irrigation reports.</Text>
          <Text style={styles.errorText}>Please try again.</Text>
          <AppButton title="Retry" onPress={onRetry} />
        </View>
      ) : reports.length === 0 ? (
        <Text style={styles.dailyMuted}>No daily irrigation reports available.</Text>
      ) : filteredReports.length === 0 ? (
        <View style={styles.noDaysState}>
          <Illustration name="empty-farm" height={118} />
          <Text style={styles.noDaysTitle}>No days to show</Text>
          <Text style={styles.noDaysText}>Try a different lifecycle filter to view available irrigation report days.</Text>
        </View>
      ) : (
        <>
          <Animated.View style={[styles.dayNav, { opacity: fade }]}>
            <Pressable
              disabled={page === 0}
              onPress={() => onPageChange(Math.max(0, page - 1))}
              style={[styles.arrowButton, page === 0 && styles.disabledArrow]}
              accessibilityLabel="Previous report days"
            >
              <ChevronLeft size={20} color={page === 0 ? palette.caption : palette.primary} />
            </Pressable>
            <View style={styles.dayButtons}>
              {visibleReports.map((report) => {
                const active = report.crop_day === selectedDay;
                return (
                  <Pressable key={`${report.farm_id}-${report.crop_day}-${report.report_date}`} style={[styles.dayButton, active && styles.activeDayButton]} onPress={() => openReport(report)}>
                    <Text style={[styles.dayText, active && styles.activeDayText]}>Day {report.crop_day ?? placeholder}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              disabled={page >= maxPage}
              onPress={() => onPageChange(Math.min(maxPage, page + 1))}
              style={[styles.arrowButton, page >= maxPage && styles.disabledArrow]}
              accessibilityLabel="Next report days"
            >
              <ChevronRight size={20} color={page >= maxPage ? palette.caption : palette.primary} />
            </Pressable>
          </Animated.View>
          <Text style={styles.dailyMuted}>
            Showing {start + 1}-{Math.min(start + DAYS_PER_PAGE, filteredReports.length)} of {filteredReports.length} matching reports
          </Text>
        </>
      )}
    </Card>
  );
}

function DetailsSkeleton() {
  return (
    <View style={styles.skeletonStack}>
      {[0, 1, 2, 3].map((item) => (
        <Card key={item} style={styles.skeletonCard}>
          <View style={[styles.skeleton, styles.skeletonTitle]} />
          <View style={[styles.skeleton, styles.skeletonLine]} />
          <View style={[styles.skeleton, styles.skeletonLineShort]} />
        </Card>
      ))}
    </View>
  );
}

function CropHealthScoreChart({ reports, isLoading }: { reports: IrrigationReport[]; isLoading: boolean }) {
  const [activePoint, setActivePoint] = useState<HealthPoint | null>(null);
  const points = useMemo(
    () =>
      reports
        .filter((report) => typeof report.satellite?.health_score === "number" && Number.isFinite(report.satellite.health_score))
        .map((report) => ({
          day: report.crop_day,
          date: report.report_date,
          score: Math.max(0, Math.min(100, Number(report.satellite?.health_score))),
        })),
    [reports],
  );

  if (isLoading) {
    return (
      <Card style={styles.chartCard}>
        <SectionHeader title="Crop Health Score" caption="Loading health trend..." />
        <View style={styles.chartSkeleton} />
      </Card>
    );
  }

  if (points.length === 0) {
    return (
      <Card style={styles.chartCard}>
        <SectionHeader title="Crop Health Score" caption="Health trend across available report days." />
        <View style={styles.chartEmptyState}>
          <Illustration name="empty-farm" height={110} />
          <Text style={styles.noDaysTitle}>No crop health data available</Text>
          <Text style={styles.noDaysText}>Health score points will appear here when backend reports include crop health scores.</Text>
        </View>
      </Card>
    );
  }

  const width = 320;
  const height = 220;
  const padLeft = 42;
  const padRight = 18;
  const padTop = 24;
  const padBottom = 38;
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;
  const xFor = (index: number) => padLeft + (points.length === 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth);
  const yFor = (score: number) => padTop + chartHeight - (score / 100) * chartHeight;
  const polylinePoints = points.map((point, index) => `${xFor(index)},${yFor(point.score)}`).join(" ");
  const labelIndexes = getLabelIndexes(points.length);

  return (
    <Card style={styles.chartCard}>
      <SectionHeader title="Crop Health Score" caption="Health trend across available report days." />
      <View style={styles.legendRow}>
        <View style={styles.legendLine} />
        <Text style={styles.legendText}>Crop Health Score</Text>
      </View>
      <View style={styles.chartWrap}>
        <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
          {[0, 50, 100].map((tick) => {
            const y = yFor(tick);
            return (
              <G key={tick}>
                <Line x1={padLeft} x2={width - padRight} y1={y} y2={y} stroke="#E8EFE5" strokeWidth="1" />
                <SvgText x={padLeft - 10} y={y + 4} fontSize="10" fill={palette.caption} textAnchor="end">
                  {tick}
                </SvgText>
              </G>
            );
          })}
          <Line x1={padLeft} x2={padLeft} y1={padTop} y2={height - padBottom} stroke="#DDEBDD" strokeWidth="1.2" />
          <Line x1={padLeft} x2={width - padRight} y1={height - padBottom} y2={height - padBottom} stroke="#DDEBDD" strokeWidth="1.2" />
          <Polyline points={polylinePoints} fill="none" stroke={palette.primary} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((point, index) => {
            const x = xFor(index);
            const y = yFor(point.score);
            return (
              <Circle
                key={`${point.day}-${point.date}-${index}`}
                cx={x}
                cy={y}
                r="5.5"
                fill="#FFFFFF"
                stroke={palette.primary}
                strokeWidth="3"
                onPress={() => setActivePoint(point)}
                {...({
                  onMouseEnter: () => setActivePoint(point),
                  onMouseLeave: () => setActivePoint(null),
                } as Record<string, unknown>)}
              />
            );
          })}
          {labelIndexes.map((index) => (
            <SvgText key={index} x={xFor(index)} y={height - 14} fontSize="10" fill={palette.caption} textAnchor="middle">
              Day {points[index].day ?? index + 1}
            </SvgText>
          ))}
        </Svg>
        <Text style={styles.chartYAxisLabel}>Health Score</Text>
        {activePoint ? (
          <View style={styles.chartTooltip}>
            <Text style={styles.tooltipTitle}>Day {activePoint.day ?? placeholder}</Text>
            <Text style={styles.tooltipText}>{formatNumber(activePoint.score, 0)} health score</Text>
            <Text style={styles.tooltipText}>{formatReportDate(activePoint.date)}</Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.infoValueWrap}>
        {icon}
        <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  );
}

const formatNumber = (value?: number | null, digits = 1) =>
  typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits).replace(/\.0$/, "") : placeholder;

const formatLocation = (farmLocation?: { latitude: number; longitude: number }, reportLocation?: Record<string, unknown>) => {
  if (farmLocation && typeof farmLocation.latitude === "number" && typeof farmLocation.longitude === "number") {
    return `${farmLocation.latitude.toFixed(4)}, ${farmLocation.longitude.toFixed(4)}`;
  }
  if (reportLocation && typeof reportLocation.latitude === "number" && typeof reportLocation.longitude === "number") {
    return `${reportLocation.latitude.toFixed(4)}, ${reportLocation.longitude.toFixed(4)}`;
  }
  return placeholder;
};

const formatReportDate = (value?: string | null) => {
  if (!value) return placeholder;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
};

const getLabelIndexes = (count: number) => {
  if (count <= 5) return Array.from({ length: count }, (_, index) => index);
  const middle = Math.floor((count - 1) / 2);
  return Array.from(new Set([0, middle, count - 1]));
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
    backgroundColor: "rgba(255, 255, 255, 0.66)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.74)",
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
    fontWeight: "700",
    marginTop: 2,
  },
  card: {
    gap: 12,
  },
  healthCard: {
    gap: 14,
  },
  ndviHero: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  centerCard: {
    gap: 14,
    alignItems: "center",
  },
  errorTitle: {
    color: palette.text,
    fontSize: 20,
    fontWeight: "900",
  },
  errorText: {
    color: palette.muted,
    textAlign: "center",
    lineHeight: 21,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.54)",
    paddingBottom: 10,
  },
  infoLabel: {
    color: palette.caption,
    fontWeight: "800",
    flex: 0.9,
  },
  infoValueWrap: {
    flex: 1.3,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 6,
  },
  infoValue: {
    color: palette.text,
    fontWeight: "900",
    textAlign: "right",
    flexShrink: 1,
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
    backgroundColor: "rgba(255, 255, 255, 0.48)",
    overflow: "hidden",
  },
  progressFill: {
    height: 12,
    borderRadius: 999,
  },
  twoCol: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metric: {
    flex: 1,
    minWidth: 140,
    minHeight: 92,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.46)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.62)",
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
  recommendationCard: {
    gap: 8,
    backgroundColor: "#FFF9E8",
    borderColor: "#F0D89B",
  },
  recommendationLabel: {
    color: palette.warning,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  recommendationText: {
    color: palette.text,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "900",
  },
  imageZoom: {
    height: 230,
    borderRadius: 16,
    backgroundColor: "#EDF4EA",
    minWidth: "100%",
  },
  imageZoomContent: {
    minHeight: 230,
  },
  satelliteImage: {
    width: "100%",
    height: 230,
    borderRadius: 16,
  },
  imagePlaceholder: {
    height: 190,
    borderRadius: 16,
    backgroundColor: "#EDF4EA",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  placeholderText: {
    color: palette.caption,
    fontWeight: "800",
  },
  statusPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
  statusText: {
    fontWeight: "900",
  },
  skeletonStack: {
    gap: 14,
  },
  skeletonCard: {
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
  dailyCard: {
    gap: 14,
  },
  lifecycleBox: {
    borderRadius: 20,
    backgroundColor: palette.mint,
    borderWidth: 1,
    borderColor: "#DDEEDD",
    padding: 12,
    gap: 10,
  },
  lifecycleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  lifecycleEyebrow: {
    color: palette.caption,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  lifecycleTitle: {
    color: palette.text,
    fontSize: 17,
    fontWeight: "900",
  },
  filterButton: {
    minHeight: 42,
    maxWidth: "100%",
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  filterButtonText: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: "900",
    maxWidth: 190,
  },
  filterMenu: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: palette.border,
    padding: 6,
    gap: 4,
  },
  filterOption: {
    minHeight: 40,
    borderRadius: 14,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  activeFilterOption: {
    backgroundColor: palette.primary,
  },
  filterOptionText: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "800",
  },
  activeFilterOptionText: {
    color: "#FFFFFF",
  },
  dayNav: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
  },
  dayButtons: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  arrowButton: {
    width: 40,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: palette.lightGreen,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledArrow: {
    backgroundColor: "#F1F1F1",
    opacity: 0.65,
  },
  dayButton: {
    flexGrow: 1,
    flexBasis: 76,
    minWidth: 68,
    maxWidth: 118,
    minHeight: 50,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  activeDayButton: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  dayText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "900",
  },
  activeDayText: {
    color: "#FFFFFF",
  },
  dailyMuted: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  dailyLoading: {
    gap: 10,
  },
  dailySkeleton: {
    height: 54,
    borderRadius: 18,
    backgroundColor: "#E6EFE1",
  },
  dailyError: {
    gap: 10,
    alignItems: "flex-start",
  },
  noDaysState: {
    minHeight: 230,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
  },
  noDaysTitle: {
    color: palette.text,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  noDaysText: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    textAlign: "center",
  },
  chartCard: {
    gap: 12,
  },
  chartYAxisLabel: {
    position: "absolute",
    left: -22,
    top: 96,
    width: 90,
    color: palette.caption,
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
    transform: [{ rotate: "-90deg" }],
  },
  chartWrap: {
    minHeight: 230,
    borderRadius: 22,
    backgroundColor: "#FBFEFA",
    borderWidth: 1,
    borderColor: "#E6EFE4",
    overflow: "hidden",
    position: "relative",
    paddingTop: 6,
  },
  chartSkeleton: {
    height: 220,
    borderRadius: 22,
    backgroundColor: "#E6EFE1",
  },
  chartEmptyState: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 22,
    backgroundColor: "#FBFEFA",
    borderWidth: 1,
    borderColor: "#E6EFE4",
    padding: 16,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  legendLine: {
    width: 28,
    height: 4,
    borderRadius: 999,
    backgroundColor: palette.primary,
  },
  legendText: {
    color: palette.text,
    fontSize: 12,
    fontWeight: "900",
  },
  chartTooltip: {
    position: "absolute",
    top: 12,
    right: 12,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 2,
  },
  tooltipTitle: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  tooltipText: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "800",
  },
});
