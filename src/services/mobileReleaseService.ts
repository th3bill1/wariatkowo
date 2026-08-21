import type { MobileReleaseStatus } from "../../shared/models";
import { requestJson } from "./http";

export const mobileReleaseService = {
  latest: () => requestJson<MobileReleaseStatus>("/api/mobile/latest"),
};
