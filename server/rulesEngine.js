export function evaluateMarker(value, low, high) {
  if (value === null || value === undefined || isNaN(value)) {
    return { status: "NEEDS_REVIEW", deviationPct: 0 };
  }

  const numVal = Number(value);
  const numLow = (low !== null && low !== undefined && low !== 'N/A' && !isNaN(low)) ? Number(low) : null;
  const numHigh = (high !== null && high !== undefined && high !== 'N/A' && !isNaN(high)) ? Number(high) : null;

  // Unilateral Upper Limit Only (e.g. Total Cholesterol < 200, Fasting Glucose < 100, Triglycerides < 150)
  if (numLow === null && numHigh !== null) {
    if (numVal > numHigh) {
      const deviationPct = Number((((numVal - numHigh) / numHigh) * 100).toFixed(1));
      return { status: "HIGH", deviationPct };
    }
    return { status: "PASS", deviationPct: 0 };
  }

  // Unilateral Lower Limit Only (e.g. HDL >= 50)
  if (numHigh === null && numLow !== null) {
    if (numVal < numLow) {
      const deviationPct = Number((((numLow - numVal) / numLow) * 100).toFixed(1));
      return { status: "LOW", deviationPct };
    }
    return { status: "PASS", deviationPct: 0 };
  }

  // Both Upper & Lower Limits
  if (numLow !== null && numVal < numLow) {
    const deviationPct = Number((((numLow - numVal) / numLow) * 100).toFixed(1));
    return { status: "LOW", deviationPct };
  }

  if (numHigh !== null && numVal > numHigh) {
    const deviationPct = Number((((numVal - numHigh) / numHigh) * 100).toFixed(1));
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
    return { score: null, status: "NOT_TESTED", label: "Not Tested" };
  }

  let score = 100;
  let hasSevereFlag = false;

  for (const m of testedMarkers) {
    const item = getMarker(m);
    if (item && item.status !== "PASS" && item.status !== "NEEDS_REVIEW") {
      const dev = Math.abs(item.deviationPct || 0);
      if (dev > 15) {
        hasSevereFlag = true;
        score -= 25;
      } else {
        score -= 10;
      }
    }
  }

  const finalScore = Math.max(score, 0);
  let label = "Optimal";
  if (hasSevereFlag || finalScore < 60) {
    label = "Needs Attention";
  } else if (finalScore < 85) {
    label = "Borderline";
  }

  return { score: finalScore, status: "SCORED", label };
}
