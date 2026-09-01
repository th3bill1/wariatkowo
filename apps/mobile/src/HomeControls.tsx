import Slider from "@react-native-community/slider";
import { Lightbulb, Snowflake } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { homeOptionLabel } from "../../../shared/labels";
import type { HomeClimate, HomeLight } from "../../../shared/models";
import { useAuth } from "./AuthProvider";
import { SelectField } from "./formControls";
import { colors, fonts } from "./theme";
import { Button, s } from "./ui";

const LIGHT_COLORS = [
  { label: "Ciepła biel", color: "#ffd37d" },
  { label: "Biel", color: "#fff0cf" },
  { label: "Czerwony", color: "#ff3b30" },
  { label: "Pomarańczowy", color: "#ff9500" },
  { label: "Żółty", color: "#ffcc00" },
  { label: "Zielony", color: "#34c759" },
  { label: "Turkusowy", color: "#30b0c7" },
  { label: "Niebieski", color: "#007aff" },
  { label: "Fioletowy", color: "#af52de" },
  { label: "Różowy", color: "#ff2d55" },
] as const;

function rgbHex(rgb: [number, number, number] | null): string {
  return rgb
    ? `#${rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`
    : "#ffd37d";
}

function hexRgb(value: string): [number, number, number] | null {
  const normalized = value.trim();
  if (!/^#[0-9a-f]{6}$/i.test(normalized)) return null;
  return [1, 3, 5].map((offset) =>
    Number.parseInt(normalized.slice(offset, offset + 2), 16),
  ) as [number, number, number];
}

function DeviceState({
  state,
  available,
  label,
}: {
  state: string;
  available: boolean;
  label?: string;
}) {
  const displayed = !available
    ? "Niedostępne"
    : (label ??
      (state === "on" ? "Włączone" : state === "off" ? "Wyłączone" : state));
  return (
    <View style={styles.state}>
      <View
        style={[
          styles.stateDot,
          !available
            ? styles.dotOffline
            : state === "off"
              ? styles.dotOff
              : styles.dotOn,
        ]}
      />
      <Text style={s.meta}>{displayed}</Text>
    </View>
  );
}

function Range({
  label,
  value,
  minimumValue,
  maximumValue,
  step,
  suffix,
  disabled,
  onChange,
  onComplete,
}: {
  label: string;
  value: number;
  minimumValue: number;
  maximumValue: number;
  step: number;
  suffix: string;
  disabled?: boolean;
  onChange(value: number): void;
  onComplete(value: number): void;
}) {
  return (
    <View style={styles.range}>
      <View style={s.spaceBetween}>
        <Text style={s.body}>{label}</Text>
        <Text style={styles.rangeValue}>
          {Math.round(value * 100) / 100}
          {suffix}
        </Text>
      </View>
      <Slider
        disabled={disabled}
        maximumTrackTintColor={colors.borderStrong}
        maximumValue={maximumValue}
        minimumTrackTintColor={colors.purple}
        minimumValue={minimumValue}
        onSlidingComplete={onComplete}
        onValueChange={onChange}
        step={step}
        thumbTintColor={colors.purple}
        value={value}
      />
    </View>
  );
}

export function LightControl({
  light,
  busy,
  run,
}: {
  light: HomeLight;
  busy: boolean;
  run(action: () => Promise<unknown>): Promise<void>;
}) {
  const isOn = light.state === "on";
  const [brightness, setBrightness] = useState(light.brightness ?? 100);
  const [temperature, setTemperature] = useState(
    light.colorTemperatureKelvin ??
      Math.round(
        ((light.minColorTemperatureKelvin ?? 2_000) +
          (light.maxColorTemperatureKelvin ?? 6_500)) /
          2,
      ),
  );
  const [color, setColor] = useState(rgbHex(light.rgb));
  useEffect(() => {
    setBrightness(light.brightness ?? 100);
    if (light.colorTemperatureKelvin !== null)
      setTemperature(light.colorTemperatureKelvin);
    setColor(rgbHex(light.rgb));
  }, [light]);
  const disabled = busy || !light.available;
  const lightApi = useHomeApi();
  return (
    <View style={styles.deviceCard}>
      <View style={styles.deviceHeader}>
        <Pressable
          accessibilityLabel={
            isOn ? `Wyłącz ${light.name}` : `Włącz ${light.name}`
          }
          accessibilityRole="switch"
          accessibilityState={{ checked: isOn, disabled }}
          disabled={disabled}
          onPress={() => void run(() => lightApi.lightPower(light.id, !isOn))}
          style={({ pressed }) => [
            styles.deviceIcon,
            styles.lightIcon,
            isOn && styles.lightIconOn,
            pressed && s.pressed,
            disabled && s.disabled,
          ]}
        >
          <Lightbulb color="#9B6A19" size={25} />
        </Pressable>
        <View style={s.grow}>
          <Text style={styles.deviceName}>{light.name}</Text>
          <DeviceState available={light.available} state={light.state} />
        </View>
      </View>
      {light.supportsBrightness ? (
        <Range
          disabled={disabled}
          label="Jasność"
          maximumValue={100}
          minimumValue={1}
          onChange={setBrightness}
          onComplete={(value) =>
            void run(() =>
              lightApi.lightSettings(light.id, {
                brightness: Math.round(value),
              }),
            )
          }
          step={1}
          suffix="%"
          value={brightness}
        />
      ) : null}
      {light.supportsColor ? (
        <View style={styles.controlGroup}>
          <Text style={s.label}>Kolor</Text>
          <View
            accessibilityLabel="Paleta kolorów światła"
            style={styles.colorPalette}
          >
            {LIGHT_COLORS.map((option) => {
              const selected = color.toLowerCase() === option.color;
              return (
                <Pressable
                  accessibilityLabel={option.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled }}
                  disabled={disabled}
                  key={option.color}
                  onPress={() => {
                    setColor(option.color);
                    void run(() =>
                      lightApi.lightSettings(light.id, {
                        rgb: hexRgb(option.color)!,
                      }),
                    );
                  }}
                  style={({ pressed }) => [
                    styles.colorSwatch,
                    { backgroundColor: option.color },
                    selected && styles.colorSwatchSelected,
                    pressed && s.pressed,
                  ]}
                >
                  {selected ? <View style={styles.colorSwatchMark} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
      {light.supportsColorTemperature ? (
        <Range
          disabled={disabled}
          label="Barwa"
          maximumValue={light.maxColorTemperatureKelvin ?? 6_500}
          minimumValue={light.minColorTemperatureKelvin ?? 2_000}
          onChange={setTemperature}
          onComplete={(value) =>
            void run(() =>
              lightApi.lightSettings(light.id, {
                colorTemperatureKelvin: Math.round(value / 50) * 50,
              }),
            )
          }
          step={50}
          suffix=" K"
          value={temperature}
        />
      ) : null}
    </View>
  );
}

// Delayed import through the provider keeps controls reusable on both the home and deep-link screens.
function useHomeApi() {
  return useAuth().api.home;
}

export function ClimateControl({
  climate,
  busy,
  run,
}: {
  climate: HomeClimate;
  busy: boolean;
  run(action: () => Promise<unknown>): Promise<void>;
}) {
  const api = useHomeApi();
  const [temperature, setTemperature] = useState(
    climate.targetTemperature ?? climate.minTemperature,
  );
  const [numbers, setNumbers] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      climate.numbers.map((control) => [
        control.id,
        control.value ?? control.min,
      ]),
    ),
  );
  useEffect(() => {
    setTemperature(climate.targetTemperature ?? climate.minTemperature);
    setNumbers(
      Object.fromEntries(
        climate.numbers.map((control) => [
          control.id,
          control.value ?? control.min,
        ]),
      ),
    );
  }, [climate]);
  const disabled = busy || !climate.available;
  const isOn = climate.available && climate.state !== "off";
  return (
    <View style={styles.deviceCard}>
      <View style={styles.deviceHeader}>
        <Pressable
          accessibilityLabel={
            isOn ? "Wyłącz klimatyzację" : "Włącz klimatyzację"
          }
          accessibilityRole="switch"
          accessibilityState={{ checked: isOn, disabled }}
          disabled={disabled}
          onPress={() => void run(() => api.acPower(!isOn))}
          style={({ pressed }) => [
            styles.deviceIcon,
            styles.climateIcon,
            isOn && styles.climateIconOn,
            pressed && s.pressed,
            disabled && s.disabled,
          ]}
        >
          <Snowflake color="#3777A6" size={25} />
        </Pressable>
        <View style={s.grow}>
          <Text style={styles.deviceName}>{climate.name}</Text>
          <DeviceState
            available={climate.available}
            label={homeOptionLabel(climate.state)}
            state={climate.state}
          />
        </View>
        <View style={styles.currentTemperature}>
          <Text style={styles.temperatureValue}>
            {climate.currentTemperature ?? "—"}°C
          </Text>
          <Text style={s.meta}>w pokoju</Text>
        </View>
      </View>
      <Range
        disabled={disabled}
        label="Temperatura docelowa"
        maximumValue={climate.maxTemperature}
        minimumValue={climate.minTemperature}
        onChange={setTemperature}
        onComplete={(value) => void run(() => api.acTemperature(value))}
        step={climate.temperatureStep}
        suffix="°C"
        value={temperature}
      />
      {climate.modes.length ? (
        <SelectField
          label="Tryb"
          enabled={!disabled}
          onChange={(mode) => void run(() => api.acMode(mode))}
          options={climate.modes.map((value) => ({
            value,
            label: homeOptionLabel(value),
          }))}
          value={climate.state}
        />
      ) : null}
      {climate.fanModes.length ? (
        <SelectField
          label="Nawiew"
          enabled={!disabled}
          onChange={(mode) => void run(() => api.acFan(mode))}
          options={climate.fanModes.map((value) => ({
            value,
            label: homeOptionLabel(value),
          }))}
          value={climate.fanMode ?? climate.fanModes[0]}
        />
      ) : null}
      {climate.swingModes.length ? (
        <SelectField
          label="Żaluzja pionowa"
          enabled={!disabled}
          onChange={(mode) => void run(() => api.acSwing(mode))}
          options={climate.swingModes.map((value) => ({
            value,
            label: homeOptionLabel(value),
          }))}
          value={climate.swingMode ?? climate.swingModes[0]}
        />
      ) : null}
      {climate.horizontalSwingModes.length ? (
        <SelectField
          label="Żaluzja pozioma"
          enabled={!disabled}
          onChange={(mode) => void run(() => api.acHorizontalSwing(mode))}
          options={climate.horizontalSwingModes.map((value) => ({
            value,
            label: homeOptionLabel(value),
          }))}
          value={climate.horizontalSwingMode ?? climate.horizontalSwingModes[0]}
        />
      ) : null}
      {climate.switches.length ||
      climate.selects.length ||
      climate.numbers.length ? (
        <View style={styles.extras}>
          <Text style={s.label}>Funkcje dodatkowe</Text>
          {climate.switches.map((control) => {
            const enabled = control.state === "on";
            return (
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{
                  checked: enabled,
                  disabled: busy || !control.available,
                }}
                disabled={busy || !control.available}
                key={control.id}
                onPress={() =>
                  void run(() => api.acSwitch(control.id, !enabled))
                }
                style={({ pressed }) => [
                  styles.toggle,
                  enabled && styles.toggleActive,
                  pressed && s.pressed,
                ]}
              >
                <Text style={s.body}>{control.name}</Text>
                <Text style={styles.toggleValue}>
                  {enabled ? "Wł." : "Wył."}
                </Text>
              </Pressable>
            );
          })}
          {climate.selects.map((control) => (
            <SelectField
              enabled={!busy && control.available}
              key={control.id}
              label={control.name}
              onChange={(option) =>
                void run(() => api.acSelect(control.id, option))
              }
              options={control.options.map((value) => ({
                value,
                label: homeOptionLabel(value),
              }))}
              value={control.value ?? control.options[0] ?? ""}
            />
          ))}
          {climate.numbers.map((control) => {
            const value = numbers[control.id] ?? control.value ?? control.min;
            return (
              <View key={control.id} style={styles.controlGroup}>
                <Range
                  disabled={busy || !control.available}
                  label={control.name}
                  maximumValue={control.max}
                  minimumValue={control.min}
                  onChange={(next) =>
                    setNumbers((current) => ({
                      ...current,
                      [control.id]: next,
                    }))
                  }
                  onComplete={(next) =>
                    setNumbers((current) => ({
                      ...current,
                      [control.id]: next,
                    }))
                  }
                  step={control.step}
                  suffix={control.unit ?? ""}
                  value={value}
                />
                <Button
                  compact
                  disabled={busy || !control.available}
                  onPress={() =>
                    void run(() => api.acNumber(control.id, value))
                  }
                  title="Ustaw"
                  variant="ghost"
                />
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  deviceCard: {
    gap: 14,
    borderRadius: 22,
    padding: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#46265B",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 2,
  },
  deviceHeader: { flexDirection: "row", alignItems: "center", gap: 11 },
  deviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  lightIcon: { backgroundColor: "#FFF4D9" },
  lightIconOn: { borderWidth: 2, borderColor: "#FFD37D" },
  climateIcon: { backgroundColor: colors.blueSoft },
  climateIconOn: { borderWidth: 2, borderColor: colors.blue },
  deviceName: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 18 },
  state: { flexDirection: "row", alignItems: "center", gap: 6 },
  stateDot: { width: 8, height: 8, borderRadius: 4 },
  dotOn: { backgroundColor: colors.greenDark },
  dotOff: { backgroundColor: colors.muted },
  dotOffline: { backgroundColor: colors.textDanger },
  range: { gap: 2 },
  rangeValue: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 14 },
  controlGroup: { gap: 8 },
  colorPalette: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  colorSwatch: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  colorSwatchSelected: { borderWidth: 4, borderColor: colors.purple },
  colorSwatchMark: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.surface,
  },
  currentTemperature: { alignItems: "flex-end" },
  temperatureValue: {
    color: colors.text,
    fontFamily: fonts.extraBold,
    fontSize: 20,
  },
  extras: {
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 13,
  },
  toggle: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleActive: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  toggleValue: { color: colors.text, fontFamily: fonts.extraBold },
});
