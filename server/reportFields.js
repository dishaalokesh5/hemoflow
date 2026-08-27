export const BIOMARKER_ALIASES = {
  hemoglobin: ["haemoglobin", "hemoglobin", "hb", "total hemoglobin"],
  rbc: ["rbc count", "rbc", "red blood cell count", "total rbc"],
  wbc: ["wbc count", "wbc", "white blood cell count", "total leucocyte count", "tlc", "total leukocyte count"],
  platelets: ["platelet count", "platelets", "total platelet count", "plt"],
  hematocrit: ["packed cell volume", "pcv", "hematocrit", "pcv (packed cell volume)/hematocrit"],
  mcv: ["mcv", "mean corpuscular volume", "mcv (mean corpuscular volume)"],
  mch: ["mch", "mean corpuscular hemoglobin", "mch (mean corpuscular hemoglobin)"],
  mchc: ["mchc", "mean corpuscular hemoglobin concentration", "mchc (mean corpuscular hemoglobin concentration)"],
  blood_group: ["blood grouping & rh typing", "blood group", "blood grouping", "abo blood group", "blood group & rh type"],
  rh_type: ["rh type", "rh factor", "rh typing", "rhesus factor", "rh(d) type"],
  vitamin_b12: ["vitamin b12", "vit b12", "cobalamin", "vitamin b-12", "cyanocobalamin"],
  vitamin_d: ["vitamin d", "25-hydroxy vitamin d", "25-oh vitamin d", "vit d", "vitamin d3", "25-hydroxy vit d", "vitamin d (25-hydroxy vit d)"],
  calcium: ["calcium", "serum calcium"],
  ferritin: ["serum ferritin", "ferritin"],
  cholesterol: ["total cholesterol", "cholesterol", "serum cholesterol", "cholesterol total"],
  triglycerides: ["triglycerides", "serum triglycerides", "tg"],
  hdl: ["hdl cholesterol", "hdl", "hdl-c", "direct hdl"],
  ldl: ["ldl cholesterol", "ldl", "ldl-c", "direct ldl"],
  vldl: ["vldl cholesterol", "vldl", "vldl-c"],
  bilirubin: ["total bilirubin", "serum bilirubin", "bilirubin total", "bilirubin(total)"],
  alt: ["alt (sgpt)", "sgpt", "sgpt/alt", "sgpt/alt (alanine aminotransferase)", "alanine transaminase", "alt"],
  ast: ["ast (sgot)", "sgot", "sgot/ast", "sgot/ast (aspartate aminotransferase)", "aspartate transaminase", "ast"],
  alkaline_phosphatase: ["alkaline phosphatase", "sap", "alp", "alkaline phosphatase (sap)"],
  albumin: ["albumin", "serum albumin"],
  creatinine: ["serum creatinine", "creatinine"],
  bun: ["blood urea nitrogen", "bun", "blood urea nitrogen (bun)"],
  urea: ["urea", "serum urea", "blood urea"],
  uric_acid: ["uric acid", "serum uric acid"],
  tsh: ["thyroid stimulating hormone", "tsh", "thyroid stimulating hormone (tsh)"],
  glucose_fasting: ["fasting glucose", "glucose fasting", "fasting blood sugar", "fbs", "glucose fasting (fbs)", "glucose"],
  hba1c: ["hba1c", "glycated hemoglobin", "hb1c", "glycosylated haemoglobin", "glycosylated haemoglobin (hba1c)"],
  sodium: ["sodium", "serum sodium"],
  potassium: ["potassium", "serum potassium"],
  phosphorus: ["phosphorus", "serum phosphorus", "phosphate"],
  magnesium: ["magnesium", "serum magnesium"],
  pct: ["pct", "plateletcrit"]
};

// Flattened mapping for backwards compatibility
export const REPORT_FIELDS = Object.entries(BIOMARKER_ALIASES).reduce((acc, [key, aliases]) => {
  aliases.forEach(alias => {
    acc[alias.toUpperCase()] = key;
  });
  return acc;
}, {});

export function normalize(text) {
  return String(text || "").toLowerCase().trim().replace(/\./g, "").replace(/[-_]/g, " ");
}
