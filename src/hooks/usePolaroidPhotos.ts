import { useEffect, useState } from "react";
import {
  polaroidPhotosFromUrls,
  type PolaroidPhotoDefinition,
} from "../content/polaroids";
import { fetchPolaroidUrls } from "../services/imageService";

export function usePolaroidPhotos(): PolaroidPhotoDefinition[] {
  const [photos, setPhotos] = useState<PolaroidPhotoDefinition[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchPolaroidUrls(controller.signal).then((urls) => {
      if (!controller.signal.aborted) {
        setPhotos(polaroidPhotosFromUrls(urls));
      }
    });
    return () => controller.abort();
  }, []);

  return photos;
}
