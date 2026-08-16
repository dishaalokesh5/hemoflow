export function evaluateMarker(value, low, high) {
  if (value < low) {
    const deviationPct = Number((((low - value) / low) * 100).toFixed(1));
    return { status: "LOW", deviationPct };
  }
  if (value > high) {
    const deviationPct = Number((((value - high) / high) * 100).toFixed(1));
    return { status: "HIGH", deviationPct };
  }
  return { status: "PASS", deviationPct: 0 };
}

export function scoreSystem(markerKeys, results) {
  let score = 100;
  for (const key of markerKeys) {
    const item = results.find(r => r.name === key);
    if (item && item.status !== "PASS") {
      const absDev = Math.abs(item.deviationPct);
      score -= absDev <= 15 ? 10 : 25;
    }
  }
  return Math.max(0, score);
}
