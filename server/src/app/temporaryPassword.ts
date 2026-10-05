import { randomInt } from "node:crypto";

// no look-alikes (0/O, 1/l/I) so it can be read out or typed from a message
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A temporary password like "k7Qm-x2Pd-9fRt": 12 random characters in groups of four. */
export function generateTemporaryPassword(): string {
  const groups: string[] = [];
  for (let group = 0; group < 3; group += 1) {
    let part = "";
    for (let index = 0; index < 4; index += 1) {
      part += ALPHABET[randomInt(ALPHABET.length)];
    }
    groups.push(part);
  }
  return groups.join("-");
}
