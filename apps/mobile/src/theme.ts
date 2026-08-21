// Mirrors the CSS custom properties in src/styles/global.css.
export const colors = {
  background: "#FFF8F2",
  surface: "#FFFFFF",
  surfaceSoft: "#FFFCF9",
  text: "#29252E",
  muted: "#827A89",
  purple: "#7257E8",
  purpleDark: "#4F37C7",
  purpleSoft: "#EEEAFD",
  pink: "#FF88B7",
  pinkSoft: "#FFF0F6",
  peach: "#FFB17A",
  peachSoft: "#FFF0E5",
  blue: "#79B8FF",
  blueSoft: "#EAF4FF",
  green: "#94C973",
  greenDark: "#4F9467",
  greenSoft: "#EDF7E8",
  textDanger: "#93445A",
  dangerSoft: "#FCEAF0",
  border: "#E9E2F7",
  borderStrong: "#DCD1F3",
  white: "#FFFFFF",
  black: "#000000",
} as const;

export const fonts = {
  regular: "Nunito_400Regular",
  medium: "Nunito_600SemiBold",
  bold: "Nunito_700Bold",
  extraBold: "Nunito_800ExtraBold",
} as const;
