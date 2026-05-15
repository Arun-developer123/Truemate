const blockedWords = [
  "bomb",
  "kill",
  "terrorist",
  "explosive",
  "hack bank",
  "how to hack",
  "make bomb",
];

export function isAbusive(text: string) {

  const clean = text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "");

  return blockedWords.some(word => clean.includes(word));

}