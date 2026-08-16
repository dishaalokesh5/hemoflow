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
  const getMarker = (k) => Array.isArray(results) ? results.find(r => r.name === k) : results[k];

  const testedMarkers = markerKeys.filter(k => {
    const item = getMarker(k);
    return item && item.value !== null && item.value !== undefined;
  });

  if (testedMarkers.length === 0) {
    return { score: null, status: "NOT_TESTED" };
  }

  let score = 100;
  for (const m of testedMarkers) {
    const item = getMarker(m);
    if (item && item.status !== "PASS") {
      const dev = Math.abs(item.deviationPct || 0);
      score -= dev <= 15 ? 10 : dev > 15 ? 25 : 0;
    }
  }
  return { score: Math.max(score, 0), status: "SCORED" };
}
