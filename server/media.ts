import { readdir, realpath, stat } from "node:fs/promises";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";

export const IMAGE_CATEGORIES = ["polaroids", "profiles", "quiz"] as const;
export type ImageCategory = (typeof IMAGE_CATEGORIES)[number];

const imageCategories = new Set<string>(IMAGE_CATEGORIES);
const supportedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export function isImageCategory(value: string): value is ImageCategory {
  return imageCategories.has(value);
}

export function isSupportedImageFilename(filename: string): boolean {
  return (
    filename.length > 0 &&
    filename !== "." &&
    filename !== ".." &&
    !filename.includes("/") &&
    !filename.includes("\\") &&
    !filename.includes("\0") &&
    supportedExtensions.has(extname(filename).toLowerCase())
  );
}

function isInside(parent: string, candidate: string): boolean {
  const pathFromParent = relative(parent, candidate);
  return (
    pathFromParent.length > 0 &&
    pathFromParent !== ".." &&
    !pathFromParent.startsWith(`..${sep}`) &&
    !isAbsolute(pathFromParent)
  );
}

export function imageUrl(category: ImageCategory, filename: string): string {
  return `/media/${category}/${encodeURIComponent(filename)}`;
}

async function resolveCategoryDirectory(
  imagesPath: string,
  category: ImageCategory,
): Promise<string | null> {
  try {
    const rootPath = await realpath(resolve(imagesPath));
    const categoryPath = await realpath(join(rootPath, category));
    return isInside(rootPath, categoryPath) ? categoryPath : null;
  } catch {
    return null;
  }
}

export async function listImageUrls(
  imagesPath: string,
  category: ImageCategory,
): Promise<string[]> {
  try {
    const categoryPath = await resolveCategoryDirectory(imagesPath, category);
    if (!categoryPath) return [];

    const entries = await readdir(categoryPath, {
      withFileTypes: true,
    });
    return entries
      .filter((entry) => entry.isFile() && isSupportedImageFilename(entry.name))
      .map((entry) => entry.name)
      .sort((first, second) => first.localeCompare(second))
      .map((filename) => imageUrl(category, filename));
  } catch {
    return [];
  }
}

export async function resolveImageFile(
  imagesPath: string,
  category: ImageCategory,
  filename: string,
): Promise<string | null> {
  if (!isSupportedImageFilename(filename)) return null;

  try {
    const categoryPath = await resolveCategoryDirectory(imagesPath, category);
    if (!categoryPath) return null;

    const filePath = await realpath(join(categoryPath, filename));
    if (!isInside(categoryPath, filePath)) return null;

    return (await stat(filePath)).isFile() ? filePath : null;
  } catch {
    return null;
  }
}

export function createMediaRouter(imagesPath: string): Router {
  const router = Router();

  router.get(
    "/:category/:filename",
    async (request: Request, response: Response, next: NextFunction) => {
      const category = Array.isArray(request.params.category)
        ? request.params.category[0]
        : request.params.category;
      const filename = Array.isArray(request.params.filename)
        ? request.params.filename[0]
        : request.params.filename;
      if (!isImageCategory(category) || !isSupportedImageFilename(filename)) {
        response.status(404).end();
        return;
      }

      const filePath = await resolveImageFile(imagesPath, category, filename);
      if (!filePath) {
        response.status(404).end();
        return;
      }

      response.set({
        "Cache-Control": "public, max-age=0, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      });
      response.sendFile(filePath, (error) => {
        if (!error) return;
        if (!response.headersSent) {
          response.status(404).end();
          return;
        }
        next(error);
      });
    },
  );

  return router;
}

export function createImageRouter(imagesPath: string): Router {
  const router = Router();

  router.get("/api/images/polaroids", async (_request, response) => {
    response.set("Cache-Control", "no-store");
    response.json(await listImageUrls(imagesPath, "polaroids"));
  });
  router.use("/media", createMediaRouter(imagesPath));

  return router;
}
