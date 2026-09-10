export const DECKS = {
  fibonacci: ["0", "1", "2", "3", "5", "8", "13", "21", "34", "55", "89", "?", "☕"],
  modified: ["0", "½", "1", "2", "3", "5", "8", "13", "20", "40", "100", "?", "☕"],
  tshirt: ["XS", "S", "M", "L", "XL", "XXL", "?", "☕"],
  powers: ["0", "1", "2", "4", "8", "16", "32", "64", "?", "☕"],
} as const;

export type DeckName = keyof typeof DECKS;

export const DECK_LABELS: Record<DeckName, string> = {
  fibonacci: "Fibonacci",
  modified: "Fibonacci modificada",
  tshirt: "Tamanho de camiseta",
  powers: "Potências de 2",
};

/** Converte o rótulo de uma carta em número, quando possível. */
export function cardToNumber(card: string): number | null {
  if (card === "½") return 0.5;
  const n = Number(card);
  return Number.isFinite(n) ? n : null;
}
