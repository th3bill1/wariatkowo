import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import { CalendarDays, Clock, X } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { dateFromInput, dateKey, localDateTimeValue } from "./date";
import { colors, fonts } from "./theme";
import { IconButton, s } from "./ui";

export type SelectOption<T extends string = string> = {
  label: string;
  value: T;
};

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  enabled = true,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<SelectOption<T>>;
  onChange(value: T): void;
  enabled?: boolean;
}) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={[styles.picker, !enabled && s.disabled]}>
        <Picker
          dropdownIconColor={colors.purple}
          enabled={enabled}
          onValueChange={(next) => onChange(next)}
          selectedValue={value}
          style={styles.pickerControl}
        >
          {options.map((option) => (
            <Picker.Item
              key={option.value}
              label={option.label}
              value={option.value}
            />
          ))}
        </Picker>
      </View>
    </View>
  );
}

export function SwitchField({
  label,
  value,
  onChange,
  enabled = true,
}: {
  label: string;
  value: boolean;
  onChange(value: boolean): void;
  enabled?: boolean;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={s.label}>{label}</Text>
      <Switch
        disabled={!enabled}
        onValueChange={onChange}
        thumbColor={colors.white}
        trackColor={{ false: colors.borderStrong, true: colors.purple }}
        value={value}
      />
    </View>
  );
}

export function DateField({
  label,
  value,
  onChange,
  includeTime = false,
  allowClear = true,
  enabled = true,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  includeTime?: boolean;
  allowClear?: boolean;
  enabled?: boolean;
}) {
  const [mode, setMode] = useState<"date" | "time" | null>(null);
  const date = dateFromInput(value, includeTime);
  const choose = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === "dismissed" || !selected) {
      setMode(null);
      return;
    }
    if (mode === "date" && includeTime) {
      const next = new Date(selected);
      next.setHours(date.getHours(), date.getMinutes(), 0, 0);
      onChange(localDateTimeValue(next));
      setMode("time");
      return;
    }
    if (mode === "time") {
      const next = new Date(date);
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      onChange(localDateTimeValue(next));
    } else {
      onChange(dateKey(selected));
    }
    setMode(null);
  };
  const labelValue = value
    ? includeTime
      ? new Intl.DateTimeFormat("pl-PL", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(date)
      : new Intl.DateTimeFormat("pl-PL", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(date)
    : "Nie ustawiono";
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={styles.dateRow}>
        <Pressable
          accessibilityRole="button"
          disabled={!enabled}
          onPress={() => setMode("date")}
          style={({ pressed }) => [
            styles.dateButton,
            !enabled && s.disabled,
            pressed && s.pressed,
          ]}
        >
          {includeTime ? (
            <Clock color={colors.purple} size={18} />
          ) : (
            <CalendarDays color={colors.purple} size={18} />
          )}
          <Text style={styles.dateText}>{labelValue}</Text>
        </Pressable>
        {allowClear && value && enabled ? (
          <IconButton
            Icon={X}
            label="Wyczyść datę"
            onPress={() => onChange("")}
          />
        ) : null}
      </View>
      {mode ? (
        <DateTimePicker
          display="default"
          mode={mode}
          onChange={choose}
          value={date}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  picker: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    borderRadius: 14,
    overflow: "hidden",
    justifyContent: "center",
  },
  pickerControl: {
    color: colors.text,
    fontFamily: fonts.regular,
    marginHorizontal: -4,
  },
  switchRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateButton: {
    flex: 1,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  dateText: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
});
