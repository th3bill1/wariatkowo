import "dotenv/config";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { openDatabase } from "./database";

const iterations = 100_000;
const pins = {
  "member-misiek": process.env.WARIATKOWO_MISIEK_PIN,
  "member-miska": process.env.WARIATKOWO_MISKA_PIN,
};

for (const [memberId, pin] of Object.entries(pins)) {
  if (!/^\d{4}$/.test(pin ?? "")) {
    console.error(
      `Set a four-digit PIN for ${memberId} in its documented variable.`,
    );
    process.exit(1);
  }
}

const database = openDatabase();
const update = database.raw.prepare(
  "UPDATE household_members SET pin_hash=?, pin_salt=?, pin_iterations=?, updated_at=? WHERE id=?",
);
const clearSessions = database.raw.prepare(
  "DELETE FROM sessions WHERE member_id=?",
);
const transaction = database.raw.transaction(() => {
  for (const [memberId, pin] of Object.entries(pins)) {
    const salt = randomBytes(16);
    const hash = pbkdf2Sync(pin!, salt, iterations, 32, "sha256");
    update.run(
      hash.toString("hex"),
      salt.toString("hex"),
      iterations,
      new Date().toISOString(),
      memberId,
    );
    clearSessions.run(memberId);
  }
});
transaction();
database.close();
console.log("PIN hashes updated for both household members; sessions revoked.");
