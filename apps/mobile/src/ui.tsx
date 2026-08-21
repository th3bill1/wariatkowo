import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { colors, fonts } from "./theme";

export function Screen({ children }: PropsWithChildren) {
  return <View style={s.screen}>{children}</View>;
}

export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <View style={s.pageHeader}>
      {eyebrow ? <Text style={s.eyebrow}>{eyebrow}</Text> : null}
      <Text style={s.title}>{title}</Text>
      {description ? <Text style={s.subtitle}>{description}</Text> : null}
      {action ? <View style={s.headerAction}>{action}</View> : null}
    </View>
  );
}

export function Title({
  children,
  subtitle,
}: PropsWithChildren<{ subtitle?: string }>) {
  return <PageHeader title={String(children)} description={subtitle} />;
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <View style={s.sectionHeader}>
      <View style={s.grow}>
        <Text style={s.sectionTitle}>{title}</Text>
        {description ? <Text style={s.meta}>{description}</Text> : null}
      </View>
      {action}
    </View>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export function Button({
  title,
  onPress,
  disabled,
  secondary,
  variant = secondary ? "secondary" : "primary",
  Icon,
  compact,
  style,
  accessibilityLabel,
}: {
  title: string;
  onPress(): void;
  disabled?: boolean;
  secondary?: boolean;
  variant?: ButtonVariant;
  Icon?: LucideIcon;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const foreground =
    variant === "primary"
      ? colors.white
      : variant === "danger"
        ? colors.textDanger
        : colors.text;
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        s[`button_${variant}`],
        compact && s.buttonCompact,
        disabled && s.disabled,
        pressed && !disabled && s.pressed,
        style,
      ]}
    >
      {Icon ? <Icon color={foreground} size={18} strokeWidth={2.2} /> : null}
      <Text style={[s.buttonText, { color: foreground }]}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({
  Icon,
  label,
  color = colors.text,
  ...props
}: PressableProps & { Icon: LucideIcon; label: string; color?: string }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={8}
      {...props}
      style={({ pressed }) => [s.iconButton, pressed && s.pressed]}
    >
      <Icon color={color} size={20} strokeWidth={2.2} />
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  Icon,
}: {
  label: string;
  selected?: boolean;
  onPress(): void;
  Icon?: LucideIcon;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        s.chip,
        selected && s.chipSelected,
        pressed && s.pressed,
      ]}
    >
      {Icon ? (
        <Icon color={selected ? colors.purple : colors.muted} size={16} />
      ) : null}
      <Text style={[s.chipText, selected && s.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  multiline,
  style,
  ...props
}: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        selectionColor={colors.purple}
        style={[s.input, multiline && s.textarea, style]}
        multiline={multiline}
        {...props}
      />
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

export function State({
  loading,
  error,
  loadingLabel = "Ładowanie…",
  onRetry,
}: {
  loading: boolean;
  error?: string | null;
  loadingLabel?: string;
  onRetry?: () => void;
}) {
  if (loading) {
    return (
      <View accessibilityLiveRegion="polite" style={s.state}>
        <ActivityIndicator color={colors.purple} />
        <Text style={s.meta}>{loadingLabel}</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View accessibilityLiveRegion="assertive" style={[s.state, s.errorBox]}>
        <Text style={s.errorTitle}>Coś poszło nie tak.</Text>
        <Text style={s.error}>{error}</Text>
        {onRetry ? (
          <Button
            compact
            title="Spróbuj ponownie"
            variant="ghost"
            onPress={onRetry}
          />
        ) : null}
      </View>
    );
  }
  return null;
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.meta}>{description}</Text>
    </View>
  );
}

export function Divider() {
  return <View style={s.divider} />;
}

export const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
    gap: 14,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
    gap: 14,
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 17,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
    shadowColor: "#46265B",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  pageHeader: { gap: 4, paddingVertical: 4 },
  eyebrow: {
    color: colors.muted,
    fontFamily: fonts.extraBold,
    fontSize: 12,
    letterSpacing: 1.25,
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontFamily: fonts.extraBold,
    fontSize: 32,
    lineHeight: 36,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  headerAction: { alignItems: "flex-start", marginTop: 8 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.extraBold,
    fontSize: 19,
    lineHeight: 24,
  },
  grow: { flex: 1, gap: 2 },
  button: {
    minHeight: 46,
    borderRadius: 999,
    paddingHorizontal: 17,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  button_primary: { backgroundColor: colors.purple },
  button_secondary: { backgroundColor: colors.purpleSoft },
  button_ghost: {
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button_danger: { backgroundColor: colors.dangerSoft },
  buttonCompact: { minHeight: 40, paddingVertical: 8, paddingHorizontal: 13 },
  buttonText: { fontFamily: fonts.extraBold, fontSize: 14 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 40,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  chipSelected: {
    backgroundColor: colors.purpleSoft,
    borderColor: colors.purple,
  },
  chipText: { color: colors.muted, fontFamily: fonts.bold, fontSize: 13 },
  chipTextSelected: { color: colors.purple },
  field: { gap: 6 },
  fieldLabel: { color: colors.text, fontFamily: fonts.bold, fontSize: 13 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  textarea: { minHeight: 96, textAlignVertical: "top" },
  hint: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12 },
  label: { color: colors.text, fontFamily: fonts.bold, fontSize: 16 },
  body: {
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
  },
  meta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  strongMeta: { color: colors.text, fontFamily: fonts.bold, fontSize: 13 },
  error: {
    color: colors.textDanger,
    fontFamily: fonts.regular,
    lineHeight: 20,
  },
  errorTitle: {
    color: colors.textDanger,
    fontFamily: fonts.extraBold,
    fontSize: 15,
  },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 18,
    padding: 15,
  },
  successBox: {
    backgroundColor: colors.greenSoft,
    borderRadius: 18,
    padding: 15,
  },
  state: {
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
    gap: 10,
  },
  empty: { alignItems: "center", padding: 18, gap: 4 },
  emptyTitle: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 16 },
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  spaceBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  divider: { height: 1, backgroundColor: colors.border },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.purpleSoft,
    color: colors.purpleDark,
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 4,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  listRow: {
    borderRadius: 17,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 13,
    gap: 8,
  },
});
