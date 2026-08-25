import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import multer from 'multer';
import { extractText } from './pdfExtractor.js';
import { parseBiomarkers } from './biomarkerParser.js';
import { SYSTEM_GROUPS } from './systemGroups.js';
import { evaluateMarker, scoreSystem } from './rulesEngine.js';
import { getAnalysis } from './geminiReasoning.js';
import pool from './db.js';
import { runMigrations } from './migrate.js';
import { optionalToken } from './middleware/auth.js';
import authRouter from './routes/auth.js';
import reportsRouter from './routes/reports.js';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Run DB migrations idempotently on startup
runMigrations();

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Hemoflow API', timestamp: new Date().toISOString() });
});

// Auth & Report Routers
app.use('/api/auth', authRouter);
app.use('/api/reports', reportsRouter);

app.post('/api/analyze', optionalToken, upload.single('pdf'), async (req, res) => {
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

    const resultPayload = { userContext, systemScores, flags, evaluatedMarkers, geminiAnalysis };

    // Non-blocking persistence: Attempt saving if authenticated, but never fail analysis if DB save fails
    if (req.user && req.user.id) {
      try {
        const originalFilename = req.file.originalname || 'blood_report.pdf';
        const insertRes = await pool.query(
          `INSERT INTO reports (user_id, original_filename, status, analysis_data) 
           VALUES ($1, $2, 'COMPLETED', $3) 
           RETURNING id`,
          [req.user.id, originalFilename, JSON.stringify(resultPayload)]
        );
        resultPayload.reportId = insertRes.rows[0].id;
        resultPayload.saved = true;
      } catch (dbErr) {
        console.error('Database persistence failed (returning raw analysis result to user):', dbErr.message);
        resultPayload.saved = false;
      }
    }

    res.json(resultPayload);
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to analyze report." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Hemoflow backend running on port ${PORT}`));

