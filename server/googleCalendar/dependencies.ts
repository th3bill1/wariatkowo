import type { GoogleCalendarClient } from "./client";
import type { GoogleCalendarConfig } from "./config";
import type { TokenCipher } from "./tokenCipher";

export type GoogleCalendarDependencies = {
  config: GoogleCalendarConfig;
  client: GoogleCalendarClient;
  tokenCipher: TokenCipher;
};
