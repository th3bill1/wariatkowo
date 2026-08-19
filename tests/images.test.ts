import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createImageRouter,
  isSupportedImageFilename,
  listImageUrls,
  resolveImageFile,
} from "../server/media";
import { polaroidPhotosFromUrls } from "../src/content/polaroids";
import { fetchPolaroidUrls } from "../src/services/imageService";

const temporaryDirectories: string[] = [];

async function imageRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "wariatkowo-images-"));
  temporaryDirectories.push(root);
  await Promise.all(
    ["polaroids", "profiles"].map((category) => mkdir(join(root, category))),
  );
  return root;
}

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("runtime image storage", () => {
  it("discovers supported Polaroids dynamically and URL-encodes filenames", async () => {
    const root = await imageRoot();
    await Promise.all([
      writeFile(join(root, "polaroids", "kajaki.jpg"), "image"),
      writeFile(join(root, "polaroids", "zażółć.webp"), "image"),
      writeFile(join(root, "polaroids", "notes.txt"), "not an image"),
      mkdir(join(root, "polaroids", "nested.jpg")),
    ]);

    await expect(listImageUrls(root, "polaroids")).resolves.toEqual([
      "/media/polaroids/kajaki.jpg",
      "/media/polaroids/za%C5%BC%C3%B3%C5%82%C4%87.webp",
    ]);
  });

  it("returns an empty list when the mounted directory is unavailable", async () => {
    await expect(
      listImageUrls(join(tmpdir(), crypto.randomUUID()), "polaroids"),
    ).resolves.toEqual([]);
  });

  it("resolves only regular supported files inside an allowlisted category", async () => {
    const root = await imageRoot();
    const profile = join(root, "profiles", "misiek.jpg");
    await writeFile(profile, "image");

    await expect(
      resolveImageFile(root, "profiles", "misiek.jpg"),
    ).resolves.toBe(profile);
    await expect(
      resolveImageFile(root, "profiles", "../../../etc/passwd"),
    ).resolves.toBeNull();
    await expect(
      resolveImageFile(root, "profiles", "misiek.svg"),
    ).resolves.toBeNull();
    expect(isSupportedImageFilename("nested\\photo.jpg")).toBe(false);
  });

  it("serves only allowlisted media over HTTP, including Unicode filenames", async () => {
    const root = await imageRoot();
    await Promise.all([
      writeFile(join(root, "polaroids", "kajaki.jpg"), "polaroid"),
      writeFile(join(root, "profiles", "miśka.jpg"), "profile"),
    ]);
    const app = express();
    app.use(createImageRouter(root));
    const server = app.listen(0, "127.0.0.1");

    try {
      await new Promise<void>((resolveReady, reject) => {
        server.once("listening", resolveReady);
        server.once("error", reject);
      });
      const { port } = server.address() as AddressInfo;
      const baseUrl = `http://127.0.0.1:${port}`;

      const listResponse = await fetch(`${baseUrl}/api/images/polaroids`);
      expect(await listResponse.json()).toEqual([
        "/media/polaroids/kajaki.jpg",
      ]);
      expect(listResponse.headers.get("Cache-Control")).toBe("no-store");

      const unicodeResponse = await fetch(
        `${baseUrl}/media/profiles/${encodeURIComponent("miśka.jpg")}`,
      );
      expect(unicodeResponse.status).toBe(200);
      expect(unicodeResponse.headers.get("Content-Type")).toBe("image/jpeg");
      expect(await unicodeResponse.text()).toBe("profile");

      const traversalResponse = await fetch(
        `${baseUrl}/media/profiles/..%2F..%2Fetc%2Fpasswd.jpg`,
      );
      expect(traversalResponse.status).toBe(404);
      expect((await fetch(`${baseUrl}/media/unknown/kajaki.jpg`)).status).toBe(
        404,
      );
    } finally {
      await new Promise<void>((resolveClose, reject) =>
        server.close((error) => (error ? reject(error) : resolveClose())),
      );
    }
  });
});

describe("Polaroid client", () => {
  it("accepts only runtime Polaroid URLs and fails closed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json([
          "/media/polaroids/kajaki.jpg",
          "/media/profiles/misiek.jpg",
          "../../../etc/passwd",
          42,
        ]),
      ),
    );

    await expect(fetchPolaroidUrls()).resolves.toEqual([
      "/media/polaroids/kajaki.jpg",
    ]);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503 })),
    );
    await expect(fetchPolaroidUrls()).resolves.toEqual([]);
  });

  it("keeps filename-based Polaroid overrides compatible with encoded URLs", () => {
    expect(
      polaroidPhotosFromUrls([
        "/media/polaroids/za%C5%BC%C3%B3%C5%82%C4%87.jpg",
      ]),
    ).toEqual([
      {
        src: "/media/polaroids/za%C5%BC%C3%B3%C5%82%C4%87.jpg",
        alt: "",
        position: undefined,
      },
    ]);
  });
});
