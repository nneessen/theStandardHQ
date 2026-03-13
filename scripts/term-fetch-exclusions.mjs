export const MANUAL_ONLY_TERM_PRODUCTS = new Set([
  "Baltimore Life|aPriority Level Term",
  "Foresters Financial|Your Term Medical",
  "Legal & General|Term",
  "Mutual of Omaha|Term Life Answers",
  "SBLI|Term",
]);

export function termFetchProductKey(carrierName, productName) {
  return `${String(carrierName || "").trim()}|${String(productName || "").trim()}`;
}

export function isManualOnlyTermProduct(carrierName, productName) {
  return MANUAL_ONLY_TERM_PRODUCTS.has(termFetchProductKey(carrierName, productName));
}
