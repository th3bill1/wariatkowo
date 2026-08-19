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

export function polaroidPhotosFromUrls(
  urls: readonly string[],
): PolaroidPhotoDefinition[] {
  return urls.map((src) => {
    const encodedFile = src.slice(src.lastIndexOf("/") + 1);
    let file = encodedFile;
    try {
      file = decodeURIComponent(encodedFile);
    } catch {
      // Keep the URL-provided value when it contains malformed escaping.
    }
    const override = PHOTO_OVERRIDES[file];
    return {
      src,
      alt: override?.alt ?? "",
      position: override?.position,
    };
  });
}
