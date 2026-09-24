import React, { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { z } from "zod";

import { FarmMap } from "@/components/farm-map";
import { AppScreen } from "@/components/screen";
import { AppButton, Card, FieldInput, SectionHeader } from "@/components/ui";
import { useToast } from "@/components/toast";
import { createFarm } from "@/services/api";
import { useAppStore } from "@/store/appStore";
import { palette } from "@/theme/agriculture";
import type { FarmFormValues } from "@/types/domain";

type LocationModule = typeof import("expo-location");

const getLocation = (): LocationModule | null => {
  try {
    return require("expo-location") as LocationModule;
  } catch {
    return null;
  }
};

const farmSchema = z.object({
  user_id: z.string().min(1),
  farm_name: z.string().min(2, "Enter farm name"),
  crop_name: z.string().min(1, "Enter or suggest crop name"),
  area: z.object({
    value: z.coerce.number().positive("Area must be greater than 0"),
    unit: z.enum(["acre", "hectare"]),
  }),
  location: z.object({
    latitude: z.coerce.number().min(-90, "Latitude must be between -90 and 90").max(90, "Latitude must be between -90 and 90"),
    longitude: z.coerce.number().min(-180, "Longitude must be between -180 and 180").max(180, "Longitude must be between -180 and 180"),
  }),
  soil_type: z.string().optional(),
  irrigation_type: z.string().optional(),
  planting_date: z.string().optional(),
  description: z.string().optional(),
});

export function AddFarmScreen() {
  const toast = useToast();
  const auth = useAppStore((state) => state.auth);
  const draft = useAppStore((state) => state.addFarmDraft);
  const prediction = useAppStore((state) => state.predictionResult);
  const updateDraft = useAppStore((state) => state.updateFarmDraft);
  const resetDraft = useAppStore((state) => state.resetFarmDraft);
  const addFarm = useAppStore((state) => state.addFarm);
  const [locationDenied, setLocationDenied] = useState(false);
  const [success, setSuccess] = useState(false);

  const defaults = useMemo(
    () => ({
      ...draft,
      user_id: draft.user_id || auth.userId || auth.phone,
      crop_name: prediction?.recommended_crop || draft.crop_name,
    }),
    [auth.phone, auth.userId, draft, prediction?.recommended_crop],
  );

  const { control, handleSubmit, reset, getValues, setValue, formState } = useForm<FarmFormValues>({
    resolver: zodResolver(farmSchema) as never,
    defaultValues: defaults,
  });
  const selectedLocation = useWatch({ control, name: "location" });

  useEffect(() => {
    reset(defaults);
  }, [defaults, reset]);

  const requestLocation = useCallback(async () => {
  try {
    setLocationDenied(false);

    let latitude = 0;
    let longitude = 0;

    if (Platform.OS === "web") {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
          }
        );
      });

      latitude = position.coords.latitude;
      longitude = position.coords.longitude;
    } else {
      const locationModule = getLocation();
      if (!locationModule) {
        setLocationDenied(true);
        return;
      }

      const { status } = await locationModule.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setLocationDenied(true);
        return;
      }

      let location = null;

      // Try 3 times because iOS may initially return kCLErrorLocationUnknown
      for (let i = 0; i < 3; i++) {
        try {
          location = await locationModule.getCurrentPositionAsync({
            accuracy: locationModule.Accuracy.High,
          });

          if (location) break;
        } catch (err) {
          console.log(`Location attempt ${i + 1} failed`, err);

          if (i < 2) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      }

      // Fallback to last known location
      if (!location) {
        location = await locationModule.getLastKnownPositionAsync();
      }

      if (!location) {
        throw new Error("Unable to determine location.");
      }

      latitude = location.coords.latitude;
      longitude = location.coords.longitude;
    }

    updateDraft({
      location: {
        latitude,
        longitude,
      },
    });
    setValue("location.latitude", latitude, { shouldDirty: true, shouldValidate: true });
    setValue("location.longitude", longitude, { shouldDirty: true, shouldValidate: true });
    } catch (error) {
      console.log("Location Error:", error);

      toast.show(
        "Unable to determine your current location. You can enter it manually.",
        "error"
      );
    }
  }, [setValue, updateDraft, toast]);

  const setFarmLocation = useCallback(
    (latitude: number, longitude: number) => {
      const location = { latitude, longitude };
      updateDraft({ location });
      setValue("location", location, { shouldDirty: true, shouldValidate: true });
    },
    [setValue, updateDraft],
  );

  useEffect(() => {
  const timeout = setTimeout(() => {
    requestLocation().catch(() => setLocationDenied(true));
  }, 0);

    return () => clearTimeout(timeout);
  }, [requestLocation]);

  const mutation = useMutation({
    mutationFn: createFarm,
    onSuccess: (farm) => {
      addFarm(farm);
      setSuccess(true);
      toast.show("Farm saved successfully.", "success");
      resetDraft(auth.userId || auth.phone);
      setTimeout(() => router.replace("/farms" as never), 850);
    },
    onError: (error: Error) => toast.show(error.message || "Unable to save farm.", "error"),
  });

  const suggestCrop = () => {
    updateDraft(getValues());
    router.push("/predict-crop" as never);
  };

  return (
    <AppScreen withNav>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.form}>
        <SectionHeader title="Add Farm" caption="Choose your farm location by tapping the map, using GPS, or entering coordinates." />
        {success ? (
          <Card style={styles.successCard}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successText}>Farm saved</Text>
          </Card>
        ) : null}

        <Card style={styles.formCard}>
          <Controller control={control} name="farm_name" render={({ field, fieldState }) => (
            <FieldInput label="Farm Name" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
          )} />

          <Controller control={control} name="crop_name" render={({ field, fieldState }) => (
            <FieldInput
              label="Crop Name"
              value={field.value}
              onChangeText={field.onChange}
              error={fieldState.error?.message}
              right={<AppButton title="Suggest" variant="secondary" icon={<Text style={styles.suggestIcon}>AI</Text>} onPress={suggestCrop} style={styles.suggestButton} />}
            />
          )} />

          <View style={styles.row}>
            <Controller control={control} name="area.value" render={({ field, fieldState }) => (
              <FieldInput
                label="Area"
                value={String(field.value || "")}
                onChangeText={field.onChange}
                keyboardType="decimal-pad"
                error={fieldState.error?.message}
                style={styles.flexInput}
              />
            )} />
            <Controller control={control} name="area.unit" render={({ field }) => (
              <FieldInput label="Unit" value={field.value} onChangeText={field.onChange} style={styles.unitInput} />
            )} />
          </View>

          <Controller control={control} name="soil_type" render={({ field }) => (
            <FieldInput label="Soil Type" value={field.value} onChangeText={field.onChange} />
          )} />
          <Controller control={control} name="irrigation_type" render={({ field }) => (
            <FieldInput label="Irrigation Type" value={field.value} onChangeText={field.onChange} />
          )} />
          <Controller control={control} name="planting_date" render={({ field }) => (
            <FieldInput label="Planting Date" placeholder="YYYY-MM-DD" value={field.value} onChangeText={field.onChange} />
          )} />
          <Controller control={control} name="description" render={({ field }) => (
            <FieldInput label="Description" value={field.value} onChangeText={field.onChange} multiline />
          )} />

          <View style={styles.locationSection}>
            <View style={styles.locationHeader}>
              <View>
                <Text style={styles.locationTitle}>Farm Location</Text>
                <Text style={styles.locationHint}>{locationDenied ? "Tap the map or enter coordinates manually." : "Tap the map, use GPS, or edit coordinates manually."}</Text>
              </View>
              <AppButton title="Use GPS" variant="secondary" onPress={requestLocation} style={styles.gpsButton} />
            </View>
            <View style={styles.row}>
              <Controller control={control} name="location.latitude" render={({ field, fieldState }) => (
                <FieldInput
                  label="Latitude"
                  value={String(field.value ?? "")}
                  onChangeText={field.onChange}
                  keyboardType="decimal-pad"
                  error={fieldState.error?.message}
                  style={styles.flexInput}
                />
              )} />
              <Controller control={control} name="location.longitude" render={({ field, fieldState }) => (
                <FieldInput
                  label="Longitude"
                  value={String(field.value ?? "")}
                  onChangeText={field.onChange}
                  keyboardType="decimal-pad"
                  error={fieldState.error?.message}
                  style={styles.flexInput}
                />
              )} />
            </View>
            <FarmMap location={selectedLocation} onLocationChange={setFarmLocation} />
          </View>

          <AppButton title="Save Farm" loading={mutation.isPending || formState.isSubmitting} onPress={handleSubmit((values) => mutation.mutate(values as FarmFormValues))} />
        </Card>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 16,
  },
  formCard: {
    gap: 16,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  flexInput: {
    minWidth: 0,
    flex: 1,
  },
  unitInput: {
    width: 118,
    minWidth: 100,
  },
  suggestButton: {
    minHeight: 44,
    borderRadius: 14,
    marginRight: 5,
  },
  locationSection: {
    gap: 12,
    borderRadius: 18,
    backgroundColor: "rgba(234, 246, 231, 0.62)",
    borderWidth: 1,
    borderColor: "#DDEEDD",
    padding: 12,
  },
  locationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  locationTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "900",
  },
  locationHint: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  gpsButton: {
    minHeight: 42,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  locationBox: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: "rgba(234, 246, 231, 0.62)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.68)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
  },
  locationText: {
    color: palette.primary,
    fontWeight: "800",
  },
  permission: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  permissionIcon: {
    color: palette.primary,
    fontSize: 24,
    fontWeight: "900",
  },
  suggestIcon: {
    color: palette.primary,
    fontWeight: "900",
  },
  locationIcon: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  permissionTitle: {
    color: palette.text,
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  permissionText: {
    color: palette.muted,
    textAlign: "center",
    lineHeight: 22,
    fontWeight: "600",
  },
  successCard: {
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(234, 247, 232, 0.66)",
  },
  successIcon: {
    color: palette.primary,
    fontSize: 34,
    fontWeight: "900",
  },
  successText: {
    color: palette.primary,
    fontWeight: "900",
    fontSize: 18,
  },
});
