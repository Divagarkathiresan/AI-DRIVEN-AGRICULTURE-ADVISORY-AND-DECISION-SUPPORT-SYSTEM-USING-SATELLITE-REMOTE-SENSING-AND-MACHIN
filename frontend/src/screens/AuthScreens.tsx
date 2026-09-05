import React, { useCallback, useEffect, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { router, useLocalSearchParams } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { z } from "zod";

import { Illustration } from "@/components/illustrations";
import { AppButton, Card, FieldInput } from "@/components/ui";
import { useToast } from "@/components/toast";
import { registerUser, sendOtpToPhone, verifyOtpWithBackend } from "@/services/api";
import { useAppStore } from "@/store/appStore";
import { palette } from "@/theme/agriculture";

const phoneSchema = z.object({
  phone: z.string().regex(/^[0-9]{10}$/, "Enter a valid 10 digit phone number"),
});

const registerSchema = phoneSchema.extend({
  name: z.string().min(2, "Enter your full name"),
});

const otpSchema = z.object({
  otp: z.string().regex(/^[0-9]{6}$/, "Enter the 6 digit OTP"),
});

type PhoneForm = z.infer<typeof phoneSchema>;
type RegisterForm = z.infer<typeof registerSchema>;
type OtpForm = z.infer<typeof otpSchema>;

function AuthShell({ children, title, subtitle, art = "login-farm" }: { children: React.ReactNode; title: string; subtitle: string; art?: "login-farm" | "otp-landscape" }) {
  return (
    <View style={styles.background}>
      <View style={styles.shell}>
        <Text style={styles.brand}>Smart Agriculture AI</Text>
        <Card style={styles.authCard}>
          <Text style={styles.subtitle}>{title}</Text>
          <Text style={styles.caption}>{subtitle}</Text>
          {children}
        </Card>
      </View>
      <View style={styles.bottomArt}>
        <Illustration name={art} height={210} />
      </View>
    </View>
  );
}

export function LoginScreen() {
  const toast = useToast();
  const { control, handleSubmit, formState } = useForm<PhoneForm>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: "" },
  });

  const onSubmit = async ({ phone }: PhoneForm) => {
    try {
      await sendOtpToPhone({ phone: `+91${phone}` });
      router.push({ pathname: "/otp" as never, params: { phone: `+91${phone}` } });
    } catch (error: any) {
      toast.show(error.message || "Unable to send OTP.", "error");
    }
  };

  return (
    <AuthShell title="Welcome Back! 👋" subtitle="Enter your mobile number to continue">
      <Controller
        control={control}
        name="phone"
        render={({ field, fieldState }) => (
          <FieldInput
            left={<Text style={styles.prefix}>+91</Text>}
            label="+91 | Enter mobile number"
            value={field.value}
            onChangeText={(value) => field.onChange(value.replace(/\D/g, ""))}
            keyboardType="number-pad"
            maxLength={10}
            error={fieldState.error?.message}
          />
        )}
      />
      <AppButton title="Send OTP" loading={formState.isSubmitting} onPress={handleSubmit(onSubmit)} />
      <Text style={styles.securityText}>We will send you a 6 digit OTP on your mobile number</Text>
      <AppButton title="Create Account" variant="ghost" onPress={() => router.push("/register" as never)} />
    </AuthShell>
  );
}

export function RegisterScreen() {
  const toast = useToast();
  const { control, handleSubmit, formState } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", phone: "" },
  });

  const onSubmit = async (values: RegisterForm) => {
    try {
      const phone = `+91${values.phone}`;
      await sendOtpToPhone({ phone });
      toast.show("OTP sent. Verify your phone to create your account.", "success");
      router.push({ pathname: "/otp" as never, params: { phone, name: values.name } });
    } catch (error: any) {
      toast.show(error.message || "Unable to register.", "error");
    }
  };

  return (
    <AuthShell title="Create Account" subtitle="Register with OTP authentication">
      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <FieldInput label="Name" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
        )}
      />
      <Controller
        control={control}
        name="phone"
        render={({ field, fieldState }) => (
          <FieldInput
            label="Phone Number"
            value={field.value}
            onChangeText={(value) => field.onChange(value.replace(/\D/g, ""))}
            keyboardType="number-pad"
            maxLength={10}
            error={fieldState.error?.message}
            left={<Text style={styles.prefix}>+91</Text>}
          />
        )}
      />
      <AppButton title="Register" loading={formState.isSubmitting} onPress={handleSubmit(onSubmit)} />
      <AppButton title="Already registered? Login" variant="ghost" onPress={() => router.push("/login" as never)} />
    </AuthShell>
  );
}

export function OtpScreen() {
  const { phone, name } = useLocalSearchParams<{ phone?: string; name?: string }>();
  const toast = useToast();
  const hasAutoSubmitted = React.useRef(false);
  const otpInputRef = useRef<TextInput>(null);
  const setAuthenticated = useAppStore((state) => state.setAuthenticated);
  const { control, handleSubmit, formState, setValue } = useForm<OtpForm>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "" },
  });

  const phoneNumber = Array.isArray(phone) ? phone[0] : phone;
  const displayName = Array.isArray(name) ? name[0] : name;

  const normalizedPhone = (phoneNumber || "").replace(/^\+91/, "");

  const onSubmit = useCallback(async ({ otp }: OtpForm) => {
    if (!phoneNumber) {
      toast.show("Phone number is missing.", "error");
      return;
    }
    try {
      const login = await verifyOtpWithBackend({ phone: phoneNumber, otp });
      if (!login.accessToken || !login.userId) {
        throw new Error("Login succeeded but no access token was returned.");
      }
      await setAuthenticated({
        phone: phoneNumber,
        userId: login.userId,
        name: displayName,
        accessToken: login.accessToken,
      });
      if (displayName) {
        await registerUser({ uid: login.userId, name: displayName, phone: phoneNumber });
      }
      router.replace("/homepage" as never);
    } catch (error: any) {
      toast.show(error.message || "OTP verification failed.", "error");
    }
  }, [displayName, phoneNumber, setAuthenticated, toast]);

  useEffect(() => {
    if (normalizedPhone === "1234567890" && !hasAutoSubmitted.current) {
      hasAutoSubmitted.current = true;
      setValue("otp", "123456");
      handleSubmit(onSubmit)();
    }
  }, [normalizedPhone, setValue, handleSubmit, onSubmit]);

  return (
    <AuthShell title="Verify OTP" subtitle={`Enter the 6 digit code sent to ${phoneNumber || "your phone"}`} art="otp-landscape">
      <Controller
        control={control}
        name="otp"
        render={({ field, fieldState }) => (
          <>
            <Pressable onPress={() => otpInputRef.current?.focus()} style={styles.otpBoxes}>
              {Array.from({ length: 6 }).map((_, index) => (
                <View key={index} style={[styles.otpBox, fieldState.error && styles.otpError]}>
                  <Text style={styles.otpDigit}>{field.value?.[index] || ""}</Text>
                </View>
              ))}
              <TextInput
                ref={otpInputRef}
                value={field.value}
                onChangeText={(value) => field.onChange(value.replace(/\D/g, "").slice(0, 6))}
                keyboardType="number-pad"
                inputMode="numeric"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                style={styles.otpInputOverlay}
              />
            </Pressable>
            {!!fieldState.error?.message && <Text style={styles.otpErrorText}>{fieldState.error.message}</Text>}
          </>
        )}
      />
      <Text style={styles.resend}>Resend OTP in 00:30</Text>
      <AppButton title="Verify & Continue" loading={formState.isSubmitting} onPress={handleSubmit(onSubmit)} />
      <Text style={styles.securityText}>Your data is safe with us</Text>
      <AppButton title="Back" variant="ghost" onPress={() => router.back()} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  shell: {
    flex: 1,
    justifyContent: "flex-start",
    padding: 22,
    paddingTop: 70,
    gap: 18,
  },
  authCard: {
    gap: 16,
    backgroundColor: "#FFFFFF",
  },
  brand: {
    color: palette.primary,
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },
  subtitle: {
    color: palette.text,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  caption: {
    color: palette.muted,
    textAlign: "center",
    fontWeight: "600",
  },
  prefix: {
    color: palette.primary,
    fontWeight: "800",
    paddingLeft: 14,
  },
  securityText: {
    color: palette.muted,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
  },
  bottomArt: {
    marginHorizontal: 18,
    marginBottom: 10,
  },
  otpBoxes: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    position: "relative",
  },
  otpBox: {
    width: 44,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  otpError: {
    borderColor: palette.danger,
  },
  otpDigit: {
    color: palette.text,
    fontSize: 20,
    fontWeight: "900",
  },
  otpInputOverlay: {
    position: "absolute",
    inset: 0,
    opacity: 0.01,
    color: "transparent",
  },
  otpErrorText: {
    color: palette.danger,
    fontSize: 12,
    fontWeight: "600",
  },
  resend: {
    color: palette.primary,
    textAlign: "center",
    fontWeight: "800",
  },
});
