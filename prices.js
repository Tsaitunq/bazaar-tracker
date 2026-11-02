// Pure price helpers both apps share, free of any flip logic.
// A flipper trades at the top of the book, so the price is always the best order, however small it is.
// Looking deeper into the book can only widen the spread and overstate the margin.
// API names are from the instant buyer's view: sell_summary holds buy orders, buy_summary holds sell offers.
export function bookPrices(product) {
  const buy = product.sell_summary?.[0]?.pricePerUnit;
  const sell = product.buy_summary?.[0]?.pricePerUnit;
  return buy > 0 && sell > 0 ? { buy, sell } : null;
}

// The Hypixel API names the two sides of a book after the player's action, which reads backwards:
//   buy_summary  = the sell offers, cheapest first. Someone who buys at once pays these.
//   sell_summary = the buy orders, highest first. Someone who sells at once is paid these.
// The Bazaar product API gives about 30 levels per side. bookPrices() (flips.js) reads the top of each:
// .buy = sell_summary[0] (the buy order you would have to beat), .sell = buy_summary[0] (the offer to beat).
// walkBook adds up what qty items cost (or pay) when they go through the levels in order; null when the
// shown levels hold less than qty, which is a price nobody can say.
export function walkBook(levels, qty, cheapestFirst) {
  const sorted = [...(levels ?? [])].sort((x, y) => (cheapestFirst ? x.pricePerUnit - y.pricePerUnit : y.pricePerUnit - x.pricePerUnit));
  let left = qty, total = 0;
  for (const l of sorted) {
    const take = Math.min(left, l.amount);
    total += take * l.pricePerUnit;
    left -= take;
    if (left <= 0) return total;
  }
  return left <= 0 ? total : null;
}


// Auction House fees, see docs/events-sources.md. The fee for the auction's duration is not included.
export const AH_TAX_FREE = 1e6; // collecting a sale up to this much costs nothing, and the tax never cuts below it
export const AH_CLAIM_TAX = 0.01;
export const DERPY_TAX_FACTOR = 4; // while Derpy is mayor the tax on collecting is four times as high
export const ahListFee = (price) => (price > 100e6 ? 0.025 : price >= 10e6 ? 0.02 : 0.01);

// What is left of a BIN sale at `price` after the listing fee and the tax on collecting the coins.
export function ahNet(price, derpy = false) {
  const rate = AH_CLAIM_TAX * (derpy ? DERPY_TAX_FACTOR : 1);
  const claim = price > AH_TAX_FREE ? Math.min(price * rate, price - AH_TAX_FREE) : 0;
  return price - price * ahListFee(price) - claim;
}
