import { GENERATED_POLAROID_FILES } from "./generatedPolaroids";

export type PolaroidPhotoDefinition = {
  src: string;
  alt: string;
  position?: string;
};

const PHOTO_OVERRIDES: Record<
  string,
  Pick<PolaroidPhotoDefinition, "alt" | "position">
> = {
  // "example.jpg": { alt: "", position: "center 30%" },
};

export const POLAROID_PHOTOS: PolaroidPhotoDefinition[] =
  GENERATED_POLAROID_FILES.map((file) => {
    const override = PHOTO_OVERRIDES[file];
    return {
      src: `/polaroids/${encodeURIComponent(file)}`,
      alt: override?.alt ?? "",
      position: override?.position,
    };
  });
