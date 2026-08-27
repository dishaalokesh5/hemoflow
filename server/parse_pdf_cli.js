import fs from 'fs';
import path from 'path';
import { extractText } from './pdfExtractor.js';
import { parseBiomarkers } from './biomarkerParser.js';
import { evaluateMarker } from './rulesEngine.js';

async function parsePdfFile(rawFilePath) {
  if (!rawFilePath) {
    console.error('Error: Please provide a PDF file path.\nUsage: npm run parse -- "C:\\path\\to\\report.pdf"');
    process.exit(1);
  }

  // Handle paths with spaces or quotes
  let cleanPath = rawFilePath.trim().replace(/^["']|["']$/g, '');
  
  let absolutePath;
  if (path.isAbsolute(cleanPath)) {
    absolutePath = path.normalize(cleanPath);
  } else {
    // Check relative to cwd or server dir
    const fromCwd = path.resolve(process.cwd(), cleanPath);
    const fromParent = path.resolve(process.cwd(), '..', cleanPath);
    if (fs.existsSync(fromCwd)) {
      absolutePath = fromCwd;
    } else if (fs.existsSync(fromParent)) {
      absolutePath = fromParent;
    } else {
      absolutePath = fromCwd;
    }
  }

  if (!fs.existsSync(absolutePath)) {
    console.error(`Error: File not found at path: ${absolutePath}`);
    process.exit(1);
  }

  console.log(`\n=================== HEMOFLOW PDF PARSER DIAGNOSTIC ===================`);
  console.log(`File: ${path.basename(absolutePath)}`);
  console.log(`Path: ${absolutePath}\n`);

  const fileBuffer = fs.readFileSync(absolutePath);
  const rawText = await extractText(fileBuffer);
  const parsedBiomarkers = parseBiomarkers(rawText);

  console.log('--- PATIENT DEMOGRAPHICS EXTRACTED ---');
  console.log(`Age:    ${parsedBiomarkers.patientMeta?.age || 'Not Extracted / Missing'}`);
  console.log(`Gender: ${parsedBiomarkers.patientMeta?.sex || 'Not Extracted / Missing'}\n`);

  console.log('--- EXTRACTED BIOMARKERS COMPARISON TABLE ---');
  console.table(
    parsedBiomarkers.map(bm => {
      const evalRes = (bm.value !== null && typeof bm.value === 'number') 
        ? evaluateMarker(bm.value, bm.referenceLow, bm.referenceHigh)
        : { status: bm.status, deviationPct: 0 };

      return {
        Biomarker: bm.name,
        'Parsed Value': bm.value ?? 'N/A',
        'Ref Low': bm.referenceLow ?? 'N/A',
        'Ref High': bm.referenceHigh ?? 'N/A',
        Status: evalRes.status,
        'Deviation %': evalRes.deviationPct ? `${evalRes.deviationPct}%` : '0%'
      };
    })
  );

  console.log('\n=================== END OF DIAGNOSTIC REPORT ===================\n');
}

// Join all remaining CLI arguments to support unquoted paths with spaces
const inputPath = process.argv.slice(2).join(' ');
parsePdfFile(inputPath).catch(err => {
  console.error('Failed to parse PDF:', err);
  process.exit(1);
});
