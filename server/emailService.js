import nodemailer from 'nodemailer';

let cachedTransporter = null;

async function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  } else {
    // Development Fallback: Create test Ethereal account automatically
    try {
      const testAccount = await nodemailer.createTestAccount();
      cachedTransporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      console.log('[EMAIL SERVICE] Initialized Nodemailer test account (Ethereal Email)');
    } catch (err) {
      console.warn('[EMAIL SERVICE] Failed to create Ethereal test account, fallback to json transport:', err.message);
      cachedTransporter = nodemailer.createTransport({ jsonTransport: true });
    }
  }

  return cachedTransporter;
}

export async function sendReportEmail({ toEmail, patientName, reportData }) {
  const { userContext, systemScores, flags, geminiAnalysis } = reportData;
  const name = patientName || userContext?.name || 'Valued Patient';
  const age = userContext?.age || 'N/A';
  const sex = userContext?.sex || 'N/A';

  const systemScoresHtml = Object.entries(systemScores || {}).map(([sys, val]) => {
    const sysName = sys.replace('_', ' ').toUpperCase();
    const scoreVal = typeof val === 'object' && val !== null ? val.score : val;
    const label = typeof val === 'object' && val !== null ? (val.label || val.status) : 'SCORED';
    const badgeColor = (scoreVal >= 80) ? '#0D9488' : (scoreVal >= 60) ? '#D97706' : '#E11D48';
    
    return `
      <div style="display: inline-block; width: 130px; margin: 6px; padding: 12px; border: 1px solid #E2E8F0; border-radius: 8px; text-align: center; background-color: #F8FAFC;">
        <div style="font-size: 11px; color: #64748B; font-weight: bold; margin-bottom: 4px;">${sysName}</div>
        <div style="font-size: 20px; font-weight: bold; color: ${badgeColor};">${scoreVal !== null ? scoreVal + '/100' : 'N/A'}</div>
        <div style="font-size: 11px; color: ${badgeColor}; font-weight: 600;">${label}</div>
      </div>
    `;
  }).join('');

  const flagsHtml = (flags && flags.length > 0) ? flags.map(f => `
    <tr style="border-bottom: 1px solid #E2E8F0;">
      <td style="padding: 10px; font-weight: bold; color: #1E293B;">${f.name.toUpperCase()}</td>
      <td style="padding: 10px; color: #0F172A;">${f.value}</td>
      <td style="padding: 10px; color: #64748B;">${f.range?.low ?? 'N/A'} - ${f.range?.high ?? 'N/A'}</td>
      <td style="padding: 10px; color: ${f.status === 'HIGH' ? '#DC2626' : '#D97706'}; font-weight: bold;">
        ${f.status} (${f.deviationPct || 0}% dev)
      </td>
    </tr>
  `).join('') : `<tr><td colspan="4" style="padding: 12px; text-align: center; color: #0D9488; font-weight: bold;">✔ All tested markers are within normal limits!</td></tr>`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Hemoflow Blood Report Analysis</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F1F5F9; margin: 0; padding: 20px;">
      <div style="max-width: 680px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #E2E8F0;">
        
        <!-- Header -->
        <div style="background-color: #0F172A; color: #FFFFFF; padding: 24px 32px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; letter-spacing: 1px; color: #2DD4BF;">🩸 HEMOFLOW</h1>
          <p style="margin: 6px 0 0 0; font-size: 14px; color: #94A3B8;">Clinical Blood Panel Analysis & AI Insights</p>
        </div>

        <div style="padding: 32px;">
          <!-- Patient Info -->
          <div style="background-color: #F8FAFC; border-left: 4px solid #0D9488; padding: 16px 20px; border-radius: 4px; margin-bottom: 24px;">
            <h2 style="margin: 0 0 8px 0; font-size: 18px; color: #1E293B;">Patient Report Summary</h2>
            <div style="font-size: 14px; color: #475569;">
              <strong>Patient Name:</strong> ${name} &nbsp;|&nbsp;
              <strong>Age:</strong> ${age} &nbsp;|&nbsp;
              <strong>Sex:</strong> ${sex}
            </div>
          </div>

          <!-- System Scores -->
          <h3 style="font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; margin-bottom: 12px;">Organ System Scores</h3>
          <div style="margin-bottom: 28px; text-align: center;">
            ${systemScoresHtml}
          </div>

          <!-- Flagged Biomarkers -->
          <h3 style="font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; margin-bottom: 12px;">Flagged Biomarkers (${flags ? flags.length : 0})</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 28px;">
            <thead>
              <tr style="background-color: #F1F5F9; text-align: left; color: #475569;">
                <th style="padding: 10px;">Biomarker</th>
                <th style="padding: 10px;">Result</th>
                <th style="padding: 10px;">Ref Range</th>
                <th style="padding: 10px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${flagsHtml}
            </tbody>
          </table>

          <!-- Gemini AI Reasoning -->
          ${geminiAnalysis?.summary ? `
            <div style="background-color: #F0FDF4; border: 1px solid #BBF7D0; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
              <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #166534;">🧠 Clinical Pattern Synthesis</h3>
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #15803D;">${geminiAnalysis.summary}</p>
            </div>
          ` : ''}

          <!-- Disclaimer -->
          <div style="font-size: 11px; color: #94A3B8; text-align: center; border-top: 1px solid #E2E8F0; padding-top: 16px; margin-top: 24px;">
            This automated analysis report is generated by Hemoflow for informational purposes only and does not constitute medical advice or diagnosis. Always consult a qualified healthcare provider.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: `"Hemoflow Health" <${process.env.SMTP_FROM || 'reports@hemoflow.app'}>`,
    to: toEmail,
    subject: `🩸 Hemoflow Blood Analysis Report — ${name}`,
    html: htmlContent
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log('[EMAIL SERVICE] Ethereal Email Preview URL:', previewUrl);
  }

  return { success: true, messageId: info.messageId, previewUrl };
}
