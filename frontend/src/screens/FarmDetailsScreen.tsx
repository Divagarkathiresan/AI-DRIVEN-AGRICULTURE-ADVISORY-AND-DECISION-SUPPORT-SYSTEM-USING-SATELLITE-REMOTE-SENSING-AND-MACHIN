import React, { useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bell, ChevronDown, ChevronLeft, ChevronRight, Leaf, MapPin, X } from "lucide-react-native";
import { Animated, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Circle, G, Line, Path, Polyline, Rect, Text as SvgText } from "react-native-svg";

import { AppScreen } from "@/components/screen";
import { Illustration } from "@/components/illustrations";
import { AnimatedCard, AppButton, Card, SectionHeader } from "@/components/ui";
import {
  calculateCarbonCredit,
  fetchFarmIrrigationReport,
  fetchFarmIrrigationReports,
  predictMarketPrice,
  type CarbonCreditPayload,
  type CarbonCreditResult,
  type MarketPredictionResult,
} from "@/services/api";
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

const DEFAULT_MARKET = "Coimbatore, Tamil Nadu, India";
const HARVEST_WINDOWS = [
  { names: ["rice", "paddy"], startDay: 100, endDay: 140, label: "Rice / Paddy" },
  { names: ["tomato"], startDay: 110, endDay: 120, label: "Tomato" },
  { names: ["potato"], startDay: 100, endDay: 120, label: "Potato" },
];

export function FarmDetailsScreen() {
  const params = useLocalSearchParams<{ farmId?: string; backToFarms?: string }>();
  const selectedFarm = useAppStore((state) => state.selectedFarm);
  const farmId = Array.isArray(params.farmId) ? params.farmId[0] : params.farmId;
  const reportFilterParam = Array.isArray((params as { reportFilter?: string | string[] }).reportFilter)
    ? (params as { reportFilter?: string[] }).reportFilter?.[0]
    : (params as { reportFilter?: string }).reportFilter;
  const backToFarmsParam = Array.isArray(params.backToFarms) ? params.backToFarms[0] : params.backToFarms;
  const todayReportDate = useMemo(() => getTodayDateString(), []);
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["farm-irrigation", farmId, todayReportDate],
    queryFn: () => fetchFarmIrrigationReport(farmId || "", todayReportDate),
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
  const [marketDialogVisible, setMarketDialogVisible] = useState(false);
  const [carbonDialogVisible, setCarbonDialogVisible] = useState(false);
  const [dismissedHarvestFarmId, setDismissedHarvestFarmId] = useState<string | null>(null);
  const addHarvestNotification = useAppStore((state) => state.addHarvestNotification);
  const unreadNotifications = useAppStore((state) => state.notifications.filter((notification) => !notification.read).length);
  const farmCrop = selectedFarm?.crop_name || data?.crop_name || "";
  const farmArea = data?.water_requirement?.farm_area ?? selectedFarm?.area?.value ?? 0;
  const farmAreaUnit = data?.water_requirement?.unit || selectedFarm?.area?.unit || "acre";
  const displayedReports = useMemo(
    () => mergeCurrentReport(dailyReports, data, farmId),
    [dailyReports, data, farmId],
  );
  const maxCropDay = useMemo(
    () =>
      displayedReports.reduce((maxDay, report) => {
        if (typeof report.crop_day !== "number" || !Number.isFinite(report.crop_day)) return maxDay;
        return Math.max(maxDay, report.crop_day);
      }, 0),
    [displayedReports],
  );
  const canPredictMarketValue = maxCropDay >= 120;
  const harvestStatus = useMemo(
    () => getHarvestStatus(farmCrop, selectedFarm?.planting_date),
    [farmCrop, selectedFarm?.planting_date],
  );
  const harvestDialogVisible = Boolean(harvestStatus && dismissedHarvestFarmId !== farmId);

  useEffect(() => {
    if (!farmId || !data) return;
    refetchDailyReports();
  }, [data, farmId, refetchDailyReports]);

  useEffect(() => {
    if (!farmId || !harvestStatus) return;
    addHarvestNotification({
      farmId,
      title: "Time to harvest",
      message: `${harvestStatus.label} has reached its harvest window on day ${harvestStatus.daysSincePlanting}.`,
    });
  }, [addHarvestNotification, farmId, harvestStatus]);

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
        <Pressable style={styles.notificationButton} onPress={() => router.push("/notifications" as never)} accessibilityLabel="Open notifications">
          <Bell size={20} color={palette.text} />
          {unreadNotifications ? <View style={styles.notificationBadge}><Text style={styles.notificationBadgeText}>{unreadNotifications > 9 ? "9+" : unreadNotifications}</Text></View> : null}
        </Pressable>
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
              <AppButton title="Carbon credit" variant="secondary" onPress={() => setCarbonDialogVisible(true)} />
              {canPredictMarketValue ? (
                <AppButton title="Predict Market Value" onPress={() => setMarketDialogVisible(true)} />
              ) : null}
            </Card>
          </AnimatedCard>

          <AnimatedCard delay={360}>
            <CropHealthScoreChart reports={displayedReports} isLoading={dailyReportsLoading && displayedReports.length === 0} />
          </AnimatedCard>

          <AnimatedCard delay={300}>
            <DailyReportsSection
              farmId={farmId}
              farmCrop={farmCrop}
              reports={displayedReports}
              isLoading={dailyReportsLoading && displayedReports.length === 0}
              error={dailyReportsError as Error | null}
              page={dailyPage}
              initialFilter={reportFilterParam}
              onPageChange={setDailyPage}
              onRetry={() => refetchDailyReports()}
            />
          </AnimatedCard>
          <MarketValueDialog
            visible={marketDialogVisible}
            crop={farmCrop}
            onClose={() => setMarketDialogVisible(false)}
          />
          <CarbonCreditDialog
            visible={carbonDialogVisible}
            farmId={farmId}
            crop={farmCrop}
            farmArea={farmArea}
            areaUnit={farmAreaUnit}
            irrigationType={selectedFarm?.irrigation_type}
            onClose={() => setCarbonDialogVisible(false)}
          />
          {harvestStatus ? (
            <HarvestCelebrationDialog
              visible={harvestDialogVisible}
              crop={harvestStatus.label}
              daysSincePlanting={harvestStatus.daysSincePlanting}
              harvestRange={`${harvestStatus.startDay}–${harvestStatus.endDay} days`}
              onClose={() => setDismissedHarvestFarmId(farmId)}
            />
          ) : null}
        </>
      )}
    </AppScreen>
  );
}

function HarvestCelebrationDialog({
  visible,
  crop,
  daysSincePlanting,
  harvestRange,
  onClose,
}: {
  visible: boolean;
  crop: string;
  daysSincePlanting: number;
  harvestRange: string;
  onClose: () => void;
}) {
  const [motion] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visible) return;
    motion.setValue(0);
    const animation = Animated.loop(Animated.timing(motion, { toValue: 1, duration: 2400, useNativeDriver: true }));
    animation.start();
    return () => animation.stop();
  }, [motion, visible]);

  const tractorX = motion.interpolate({ inputRange: [0, 1], outputRange: [-13, 13] });
  const farmerY = motion.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -7, 0] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.harvestDialog}>
          <Pressable style={styles.dialogCloseButton} onPress={onClose} accessibilityLabel="Close harvest celebration">
            <X size={20} color={palette.text} />
          </Pressable>
          <View style={styles.confettiLayer} pointerEvents="none">
            {["#F3B42D", "#F36E55", "#2FAE63", "#4A94E8", "#A968D6", "#F3B42D"].map((color, index) => (
              <Animated.View key={`${color}-${index}`} style={[styles.confetti, { backgroundColor: color, left: `${10 + index * 16}%`, transform: [{ translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [-8 - (index % 2) * 22, 95 + index * 11] }) }, { rotate: `${index * 31}deg` }] }]} />
            ))}
          </View>
          <Text style={styles.harvestKicker}>HARVEST CELEBRATION</Text>
          <Text style={styles.harvestTitle}>Time to harvest! 🎉</Text>
          <Text style={styles.harvestCopy}>{crop} is on day {daysSincePlanting}, within its typical {harvestRange} harvest window.</Text>
          <View style={styles.harvestScene}>
            <Animated.View style={[styles.farmerMotion, { transform: [{ translateY: farmerY }] }]}><Illustration name="farmer" width={94} height={94} /></Animated.View>
            <Animated.View style={{ transform: [{ translateX: tractorX }] }}><TractorIllustration /></Animated.View>
          </View>
          <AppButton title="Plan harvest" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

function TractorIllustration() {
  return (
    <Svg width={146} height={88} viewBox="0 0 146 88">
      <Path d="M8 69h126" stroke="#B2D9A9" strokeWidth="4" strokeLinecap="round" />
      <Rect x="45" y="35" width="56" height="28" rx="7" fill="#E9A82E" />
      <Path d="M61 35V16h29l13 19z" fill={palette.primaryDark} />
      <Path d="M67 21h19l8 12H67z" fill="#C9EAF3" />
      <Rect x="98" y="43" width="26" height="18" rx="5" fill="#D98A20" />
      <Circle cx="54" cy="66" r="16" fill="#233226" /><Circle cx="54" cy="66" r="7" fill="#F7F5E9" />
      <Circle cx="111" cy="65" r="11" fill="#233226" /><Circle cx="111" cy="65" r="4" fill="#F7F5E9" />
      <Path d="M25 57h22" stroke="#E9A82E" strokeWidth="8" strokeLinecap="round" />
    </Svg>
  );
}

function CarbonCreditDialog({
  visible,
  farmId,
  crop,
  farmArea,
  areaUnit,
  irrigationType,
  onClose,
}: {
  visible: boolean;
  farmId: string;
  crop: string;
  farmArea: number;
  areaUnit: string;
  irrigationType?: string;
  onClose: () => void;
}) {
  const mutation = useMutation<CarbonCreditResult, Error, CarbonCreditPayload>({ mutationFn: calculateCarbonCredit });
  const result = mutation.data ?? null;

  const loadCarbonCredit = () => {
    mutation.reset();
    mutation.mutate({
      farm_id: farmId,
      crop: formatCropName(crop),
      farm_area: Number(farmArea),
      area_unit: areaUnit || "acre",
      // The current farm records only retain irrigation type. These baseline values
      // satisfy the existing API contract without changing any backend behavior.
      irrigation_method: normalizeIrrigationMethod(irrigationType),
      fertilizer_type: "Chemical",
      tillage_practice: "Conventional",
      residue_management: "Burned",
      fertilizer_quantity_kg: 0,
      water_usage_liters_per_day: 0,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onShow={loadCarbonCredit}>
      <View style={styles.modalOverlay}>
        <View style={styles.carbonDialog}>
          <Pressable style={styles.dialogCloseButton} onPress={onClose} accessibilityLabel="Close carbon credit dialog">
            <X size={20} color={palette.text} />
          </Pressable>
          <View style={styles.carbonDialogHeader}>
            <View style={styles.carbonIconWrap}><Leaf size={23} color={palette.primary} /></View>
            <Text style={styles.dialogTitle}>Carbon Credit Score</Text>
            <Text style={styles.dialogSubtitle}>Estimated for {formatCropName(crop)} · {formatNumber(farmArea)} {areaUnit}</Text>
          </View>
          {mutation.isPending ? (
            <View style={styles.carbonLoading}><Text style={styles.carbonLoadingText}>Calculating your farm’s carbon potential...</Text></View>
          ) : null}
          {mutation.error ? <Text style={styles.dialogError}>{mutation.error.message || "Unable to calculate carbon credit."}</Text> : null}
          {result ? <CarbonCreditResultView result={result} /> : null}
        </View>
      </View>
    </Modal>
  );
}

function CarbonCreditResultView({ result }: { result: CarbonCreditResult }) {
  const unit = result.unit || "tCO2e";
  return (
    <View style={styles.carbonResult}>
      <View style={styles.carbonScoreCard}>
        <Text style={styles.carbonScoreLabel}>ESTIMATED CREDIT POTENTIAL</Text>
        <Text style={styles.carbonScoreValue}>{formatNumber(result.estimated_carbon_credit_potential, 2)}</Text>
        <Text style={styles.carbonScoreUnit}>{unit}</Text>
        <View style={styles.carbonStatusPill}><Text style={styles.carbonStatusText}>{result.carbon_status}</Text></View>
      </View>
      <View style={styles.carbonMetrics}>
        <CarbonMetric label="Baseline emissions" value={result.baseline_emission_tco2e} unit={unit} />
        <CarbonMetric label="Project emissions" value={result.project_emission_tco2e} unit={unit} />
        <CarbonMetric label="CO₂e reduction" value={result.estimated_co2e_reduction_tco2e} unit={unit} highlight />
      </View>
      <Text style={styles.carbonNotice}>This is an advisory estimate, not an official carbon-credit verification or issuance.</Text>
    </View>
  );
}

function CarbonMetric({ label, value, unit, highlight }: { label: string; value: number; unit: string; highlight?: boolean }) {
  return (
    <View style={[styles.carbonMetric, highlight && styles.carbonMetricHighlight]}>
      <Text style={styles.carbonMetricLabel}>{label}</Text>
      <Text style={[styles.carbonMetricValue, highlight && styles.carbonMetricValueHighlight]}>{formatNumber(value, 2)} <Text style={styles.carbonMetricUnit}>{unit}</Text></Text>
    </View>
  );
}

function MarketValueDialog({ visible, crop, onClose }: { visible: boolean; crop: string; onClose: () => void }) {
  const [market, setMarket] = useState(DEFAULT_MARKET);
  const [variety, setVariety] = useState("");
  const [varietyOpen, setVarietyOpen] = useState(false);
  const varietyOptions = useMemo(() => getVarietyOptions(crop), [crop]);
  const mutation = useMutation<MarketPredictionResult, Error, { crop: string; market: string; variety: string }>({
    mutationFn: predictMarketPrice,
  });
  const prediction = mutation.data ?? null;

  const resetDialog = () => {
    setMarket(DEFAULT_MARKET);
    setVariety(varietyOptions[0]);
    setVarietyOpen(false);
    mutation.reset();
  };

  const runPrediction = () => {
    const cropName = formatCropName(crop || "Potato");
    const marketName = market.trim() || DEFAULT_MARKET;
    const varietyName = variety || varietyOptions[0];
    mutation.mutate({ crop: cropName, market: marketName, variety: varietyName });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onShow={resetDialog}>
      <View style={styles.modalOverlay}>
        <View style={styles.marketDialog}>
          <Pressable style={styles.dialogCloseButton} onPress={onClose} accessibilityLabel="Close market value dialog">
            <X size={20} color={palette.text} />
          </Pressable>
          <Text style={styles.dialogTitle}>Predict Market Value</Text>
          <Text style={styles.dialogSubtitle}>Crop: {formatCropName(crop || "Potato")}</Text>
          <View style={styles.dialogField}>
            <Text style={styles.dialogLabel}>Market / Location</Text>
            <TextInput
              value={market}
              onChangeText={setMarket}
              placeholder={DEFAULT_MARKET}
              placeholderTextColor="#8C9685"
              style={styles.dialogInput}
            />
          </View>
          <View style={styles.dialogField}>
            <Text style={styles.dialogLabel}>Variety</Text>
            <Pressable style={styles.varietySelect} onPress={() => setVarietyOpen((value) => !value)} accessibilityLabel="Select variety">
              <Text style={styles.varietySelectText}>{variety || varietyOptions[0]}</Text>
              <ChevronDown size={18} color={palette.primary} />
            </Pressable>
            {varietyOpen ? (
              <View style={styles.varietyMenu}>
                {varietyOptions.map((option) => {
                  const active = option === (variety || varietyOptions[0]);
                  return (
                    <Pressable
                      key={option}
                      style={[styles.varietyOption, active && styles.activeVarietyOption]}
                      onPress={() => {
                        setVariety(option);
                        setVarietyOpen(false);
                      }}
                    >
                      <Text style={[styles.varietyOptionText, active && styles.activeVarietyOptionText]}>{option}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
          <AppButton title="Predict" loading={mutation.isPending} onPress={runPrediction} />
          {mutation.error ? <Text style={styles.dialogError}>{mutation.error.message || "Unable to predict market price."}</Text> : null}
          {prediction ? (
            <View style={styles.predictionBox}>
              <Text style={styles.predictionHeading}>Market Value Prediction</Text>
              <PredictionRow label="Crop" value={prediction.crop} />
              <PredictionRow label="Market" value={prediction.market} />
              <PredictionRow label="Variety" value={prediction.variety} />
              <PredictionRow label="Current Price" value={`₹${prediction.current_price.toFixed(2)}`} />
              <PredictionRow label="Predicted Price" value={`₹${prediction.predicted_price.toFixed(2)}`} highlight />
              <PredictionRow label="Prediction Date" value={prediction.prediction_date} />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function PredictionRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={[styles.predictionRow, highlight && styles.highlightPredictionRow]}>
      <Text style={styles.predictionLabel}>{label}</Text>
      <Text style={[styles.predictionValue, highlight && styles.highlightPredictionValue]}>{value}</Text>
    </View>
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
    router.push({
      pathname: "/daily-report" as never,
      params: {
        farmId,
        cropDay: String(report.crop_day),
        reportDate: report.report_date || "",
        reportFilter: selectedFilter,
      },
    });
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
              {visibleReports.map((report, index) => {
                const active = report.crop_day === selectedDay;
                return (
                  <Pressable key={getReportKey(report, index)} style={[styles.dayButton, active && styles.activeDayButton]} onPress={() => openReport(report)}>
                    <Text style={[styles.dayText, active && styles.activeDayText]}>{formatDayButtonLabel(report)}</Text>
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

const formatDayButtonLabel = (report: IrrigationReport) => {
  if (typeof report.crop_day === "number") return `Day ${report.crop_day}`;
  if (report.report_date) return formatReportDate(report.report_date);
  return `Day ${placeholder}`;
};

const getVarietyOptions = (cropName?: string) => {
  const normalized = (cropName || "").trim().toLowerCase();
  if (normalized.includes("tomato")) return ["Deshi", "Hybrid"];
  if (normalized.includes("potato")) return ["Red Nanital", "Other"];
  if (normalized.includes("pepper")) return ["Pepper", "Black Pepper"];
  return ["Other"];
};

const normalizeIrrigationMethod = (irrigationType?: string) => {
  const value = (irrigationType || "").trim().toLowerCase();
  if (value.includes("drip")) return "Drip";
  if (value.includes("sprinkler")) return "Sprinkler";
  return "Flood";
};

const getReportIdentity = (report: IrrigationReport, fallbackIndex = 0) => {
  if (report.report_date) return `date:${report.report_date}`;
  if (typeof report.crop_day === "number") return `day:${report.crop_day}`;
  return `index:${fallbackIndex}`;
};

const getReportKey = (report: IrrigationReport, index: number) => getReportIdentity(report, index);

const mergeCurrentReport = (reports: IrrigationReport[], currentReport?: IrrigationReport, farmId?: string) => {
  const mergedByKey = new Map<string, IrrigationReport>();
  const sourceReports = currentReport ? [...reports, currentReport] : reports;

  sourceReports.forEach((report, index) => {
    const normalizedReport: IrrigationReport = {
      ...report,
      farm_id: report.farm_id || farmId || "",
    };
    mergedByKey.set(getReportIdentity(normalizedReport, index), normalizedReport);
  });

  return [...mergedByKey.values()].sort((a, b) => {
    const dayA = typeof a.crop_day === "number" ? a.crop_day : Number.MAX_SAFE_INTEGER;
    const dayB = typeof b.crop_day === "number" ? b.crop_day : Number.MAX_SAFE_INTEGER;
    if (dayA !== dayB) return dayA - dayB;
    return String(a.report_date || "").localeCompare(String(b.report_date || ""));
  });
};

const getTodayDateString = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getHarvestStatus = (cropName?: string, plantingDate?: string) => {
  if (!cropName || !plantingDate) return null;
  const harvestWindow = HARVEST_WINDOWS.find((window) => {
    const normalizedCrop = cropName.trim().toLowerCase();
    return window.names.some((name) => normalizedCrop.includes(name));
  });
  const plantedAt = parseLocalDate(plantingDate);
  if (!harvestWindow || !plantedAt) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysSincePlanting = Math.floor((today.getTime() - plantedAt.getTime()) / 86_400_000);
  if (daysSincePlanting < harvestWindow.startDay) return null;

  return { ...harvestWindow, daysSincePlanting };
};

const parseLocalDate = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
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
  notificationButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.66)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.74)",
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#D94C3D",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  notificationBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(21, 36, 20, 0.42)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  harvestDialog: {
    width: "100%",
    maxWidth: 430,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D7EBD2",
    paddingHorizontal: 22,
    paddingTop: 48,
    paddingBottom: 20,
    alignItems: "center",
    gap: 12,
    overflow: "hidden",
  },
  confettiLayer: { ...StyleSheet.absoluteFill },
  confetti: { position: "absolute", top: 18, width: 9, height: 16, borderRadius: 3 },
  harvestKicker: { color: palette.primary, fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  harvestTitle: { color: palette.text, fontSize: 27, fontWeight: "900", textAlign: "center" },
  harvestCopy: { color: palette.muted, textAlign: "center", fontSize: 14, fontWeight: "600", lineHeight: 21 },
  harvestScene: { width: "100%", height: 116, flexDirection: "row", justifyContent: "center", alignItems: "flex-end", gap: 2, backgroundColor: "#F0FAEC", borderRadius: 19, paddingHorizontal: 10 },
  farmerMotion: { marginBottom: 5 },
  marketDialog: {
    width: "100%",
    maxWidth: 430,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 18,
    paddingTop: 56,
    paddingBottom: 18,
    gap: 13,
  },
  carbonDialog: {
    width: "100%",
    maxWidth: 430,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 18,
    paddingTop: 48,
    paddingBottom: 18,
    gap: 16,
  },
  carbonDialogHeader: {
    alignItems: "center",
    gap: 7,
  },
  carbonIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.lightGreen,
    borderWidth: 1,
    borderColor: "#D8ECD6",
  },
  carbonLoading: {
    minHeight: 150,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  carbonLoadingText: {
    color: palette.muted,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 21,
  },
  carbonResult: {
    gap: 12,
  },
  carbonScoreCard: {
    alignItems: "center",
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 14,
    backgroundColor: "#F1F8EF",
    borderWidth: 1,
    borderColor: "#D5EAD2",
    gap: 4,
  },
  carbonScoreLabel: {
    color: palette.caption,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  carbonScoreValue: {
    color: palette.primary,
    fontSize: 36,
    fontWeight: "900",
    lineHeight: 42,
  },
  carbonScoreUnit: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: "800",
  },
  carbonStatusPill: {
    marginTop: 7,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D5EAD2",
  },
  carbonStatusText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  carbonMetrics: {
    gap: 8,
  },
  carbonMetric: {
    minHeight: 51,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E1ECE0",
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "#FBFEFA",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  carbonMetricHighlight: {
    backgroundColor: palette.lightGreen,
    borderColor: "#CBE7C8",
  },
  carbonMetricLabel: {
    color: palette.caption,
    fontSize: 12,
    fontWeight: "800",
    flex: 1,
  },
  carbonMetricValue: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "900",
    textAlign: "right",
  },
  carbonMetricValueHighlight: {
    color: palette.primary,
  },
  carbonMetricUnit: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "800",
  },
  carbonNotice: {
    color: palette.caption,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    paddingHorizontal: 10,
  },
  dialogCloseButton: {
    position: "absolute",
    top: 14,
    left: 14,
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: palette.lightGreen,
    borderWidth: 1,
    borderColor: "#D8ECD6",
    alignItems: "center",
    justifyContent: "center",
  },
  dialogTitle: {
    color: palette.text,
    fontSize: 21,
    fontWeight: "900",
    textAlign: "center",
  },
  dialogSubtitle: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  dialogField: {
    gap: 7,
  },
  dialogLabel: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "800",
  },
  dialogInput: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FBFEFA",
    color: palette.text,
    fontSize: 15,
    fontWeight: "700",
    paddingHorizontal: 14,
  },
  dialogError: {
    color: palette.danger,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  varietySelect: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "#FBFEFA",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  varietySelectText: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "800",
  },
  varietyMenu: {
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: palette.border,
    padding: 6,
    gap: 4,
  },
  varietyOption: {
    minHeight: 40,
    borderRadius: 12,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  activeVarietyOption: {
    backgroundColor: palette.primary,
  },
  varietyOptionText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "800",
  },
  activeVarietyOptionText: {
    color: "#FFFFFF",
  },
  predictionBox: {
    borderRadius: 16,
    backgroundColor: "#F3F8F0",
    borderWidth: 1,
    borderColor: "#DDEEDD",
    padding: 12,
    gap: 8,
  },
  predictionHeading: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 2,
  },
  predictionRow: {
    minHeight: 42,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(221, 238, 221, 0.9)",
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  highlightPredictionRow: {
    backgroundColor: palette.lightGreen,
    borderColor: "#CBE7C8",
  },
  predictionLabel: {
    color: palette.caption,
    fontSize: 12,
    fontWeight: "800",
    flex: 1,
  },
  predictionValue: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "900",
    flex: 1,
    textAlign: "right",
  },
  highlightPredictionValue: {
    color: palette.primary,
    fontSize: 16,
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
