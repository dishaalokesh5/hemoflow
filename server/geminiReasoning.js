import { GoogleGenAI } from '@google/genai';

export async function getAnalysis(fullPanelJson, userContext) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    throw new Error('GEMINI_API_KEY is missing in server/.env. Please set your API key in server/.env and restart the server.');
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `User Context: ${JSON.stringify(userContext)}
Deterministic Analysis (AUTHORITATIVE - DO NOT ALTER OR RE-CALCULATE):
${JSON.stringify(fullPanelJson, null, 2)}

Instructions:
1. Identify 1-3 cross-marker patterns among flagged markers (e.g., lipid imbalance, metabolic markers, vitamin deficiencies).
2. Provide a short overall summary and cautious, non-diagnostic next steps.
3. Return ONLY valid JSON matching this schema:
{
  "summary": "string",
  "patterns": [
    {
      "title": "string",
      "markers": ["string"],
      "explanation": "string"
    }
  ],
  "next_steps": ["string"]
}`;

  let response;
  try {
    response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });
  } catch (err) {
    response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });
  }

  return JSON.parse(response.text);
}
