export type DoodleVisualKind = "svg" | "image";

export type DoodleVisualConfig =
  | {
      kind: "svg";
      icon:
        "coffee" | "plant" | "paw" | "pizza" | "house" | "heart" | "suitcase";
    }
  | {
      kind: "image";
      src: string;
      alt: string;
    };

export type DoodlePlacement = {
  id: string;
  visual: DoodleVisualConfig;
  title: string;
  depth: number;
  x: number;
  y: number;
  size: number;
  rotate: number;
  mobileX?: number;
  mobileY?: number;
  interactive?: boolean;
};

export const DOODLES: readonly DoodlePlacement[] = [
  {
    id: "coffee",
    visual: { kind: "svg", icon: "coffee" },
    title: "Kawa",
    depth: 0.35,
    x: 8,
    y: 16,
    size: 84,
    rotate: -8,
    mobileX: 2,
    mobileY: 14,
  },
  {
    id: "plant",
    visual: { kind: "svg", icon: "plant" },
    title: "Roślina",
    depth: 0.22,
    x: 12,
    y: 74,
    size: 96,
    rotate: 5,
    mobileX: 7,
    mobileY: 76,
  },
  {
    id: "paw",
    visual: { kind: "svg", icon: "paw" },
    title: "Pies",
    depth: 0.45,
    x: 83,
    y: 14,
    size: 84,
    rotate: 10,
    interactive: true,
    mobileX: 78,
    mobileY: 13,
  },
  {
    id: "pizza",
    visual: { kind: "svg", icon: "pizza" },
    title: "Pizza",
    depth: 0.28,
    x: 88,
    y: 40,
    size: 88,
    rotate: -12,
    mobileX: 80,
    mobileY: 42,
  },
  {
    id: "house",
    visual: { kind: "svg", icon: "house" },
    title: "Domek",
    depth: 0.3,
    x: 77,
    y: 77,
    size: 94,
    rotate: 4,
    mobileX: 70,
    mobileY: 78,
  },
  {
    id: "heart",
    visual: { kind: "svg", icon: "heart" },
    title: "Serce",
    depth: 0.18,
    x: 50,
    y: 10,
    size: 64,
    rotate: -6,
  },
  {
    id: "suitcase",
    visual: { kind: "svg", icon: "suitcase" },
    title: "Walizka",
    depth: 0.33,
    x: 58,
    y: 82,
    size: 88,
    rotate: 8,
    mobileX: 55,
    mobileY: 81,
  },
] as const;
