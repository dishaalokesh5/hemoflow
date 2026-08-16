import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import multer from 'multer';
import { extractText } from './pdfExtractor.js';
import { parseBiomarkers } from './biomarkerParser.js';
import { SYSTEM_GROUPS } from './systemGroups.js';
import { evaluateMarker, scoreSystem } from './rulesEngine.js';
import { getAnalysis } from './geminiReasoning.js';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

app.post('/api/analyze', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "PDF file is required." });

    const userContext = {
      name: req.body.name || 'Anonymous',
      age: req.body.age ? Number(req.body.age) : null,
      sex: req.body.sex || 'Not specified',
      fasting: req.body.fasting === 'true' || req.body.fasting === true
    };

    const rawText = await extractText(req.file.buffer);
    const parsedBiomarkers = parseBiomarkers(rawText);

    const evaluatedMarkers = parsedBiomarkers.map(bm => {
      if (typeof bm.value === 'string') {
        return {
          ...bm,
          range: { low: 'N/A', high: 'N/A' },
          status: 'PASS',
          deviationPct: 0
        };
      }

      const hasExtractedRange = (bm.referenceLow !== null && bm.referenceLow !== undefined && bm.referenceHigh !== null && bm.referenceHigh !== undefined);
      const range = hasExtractedRange ? { low: bm.referenceLow, high: bm.referenceHigh } : null;

      if (bm.value === null || !hasExtractedRange) {
        return {
          ...bm,
          range: range || { low: null, high: null },
          status: 'NEEDS_REVIEW',
          deviationPct: 0
        };
      }

      const evalRes = evaluateMarker(bm.value, range.low, range.high);
      return { ...bm, range, ...evalRes };
    });

    const systemScores = {};
    for (const [system, keys] of Object.entries(SYSTEM_GROUPS)) {
      systemScores[system] = scoreSystem(keys, evaluatedMarkers);
    }

    const flags = evaluatedMarkers.filter(m => m.status !== 'PASS');
    const fullPanelJson = { markers: evaluatedMarkers, systemScores };

    const geminiAnalysis = await getAnalysis(fullPanelJson, userContext);

    res.json({ userContext, systemScores, flags, evaluatedMarkers, geminiAnalysis });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to analyze report." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Hemoflow backend running on port ${PORT}`));
