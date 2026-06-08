const { DocumentAnalysisClient, AzureKeyCredential } = require("@azure/ai-form-recognizer");
const mongoose = require("mongoose");
const { EmailClient } = require("@azure/communication-email");

// ─── Config ───────────────────────────────────────────────────────────────────
const FORM_RECOGNIZER_ENDPOINT = process.env.FORM_RECOGNIZER_ENDPOINT;
const FORM_RECOGNIZER_KEY = process.env.FORM_RECOGNIZER_KEY;
const MONGODB_URI = process.env.COSMOS_MONGODB_URI;
const ACS_CONNECTION_STRING = process.env.ACS_CONNECTION_STRING;
const ACS_SENDER_ADDRESS = process.env.ACS_SENDER_ADDRESS; // e.g. DoNotReply@xxxxxxxx.azurecomm.net
const APP_BASE_URL = process.env.APP_BASE_URL || "https://aegishealth.io";
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;

// ─── Mongoose schema (matches your existing medicalrecords collection) ─────────
const MedicalRecordSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.Mixed,
  date: String,
  category: String,
  title: String,
  description: String,
  notes: String,
  blobUrl: String,
  blobName: String,
  processingStatus: { type: String, enum: ['none', 'pending', 'processed', 'failed', 'empty'], default: 'none' },
  extractedText: String,
}, { timestamps: true, collection: 'medicalrecords' });

let MedicalRecord = null;
let dbConnected = false;

async function connectDB() {
  if (dbConnected) return;
  if (!MONGODB_URI) {
    throw new Error("COSMOS_MONGODB_URI environment variable is not set.");
  }
  await mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  MedicalRecord = mongoose.models.MedicalRecord || mongoose.model("MedicalRecord", MedicalRecordSchema);
  dbConnected = true;
}

// ─── Derive a public blob URL from connection string + blob path ──────────────
function buildBlobUrl(blobPath) {
  try {
    const match = AZURE_STORAGE_CONNECTION_STRING.match(/AccountName=([^;]+)/);
    if (!match) return null;
    const accountName = match[1];
    return `https://${accountName}.blob.core.windows.net/health-records/${blobPath}`;
  } catch {
    return null;
  }
}

// ─── Main Function ────────────────────────────────────────────────────────────
module.exports = async function (context, myBlob) {
  const userId = context.bindingData.userId;
  const filename = context.bindingData.filename;
  const blobPath = `${userId}/${filename}`;

  context.log(`[health-record-processor] Triggered for: ${blobPath} (${myBlob.length} bytes)`);

  const blobUrl = buildBlobUrl(blobPath);
  const title = filename.replace(/^[a-f0-9\-]{36}\./, "").replace(/\.[^.]+$/, "") || filename;
  const processedAt = new Date().toISOString();

  let extractedText = "";
  let processingStatus = "failed";

  // ─── Step 1: OCR via Azure Document Intelligence ──────────────────────────
  try {
    if (!FORM_RECOGNIZER_ENDPOINT || !FORM_RECOGNIZER_KEY) {
      throw new Error("Form Recognizer credentials not configured.");
    }
    const docClient = new DocumentAnalysisClient(
      FORM_RECOGNIZER_ENDPOINT,
      new AzureKeyCredential(FORM_RECOGNIZER_KEY)
    );
    context.log("[health-record-processor] Starting OCR...");
    const poller = await docClient.beginAnalyzeDocument("prebuilt-read", myBlob);
    const result = await poller.pollUntilDone();

    if (result && result.pages) {
      const lines = [];
      for (const page of result.pages) {
        if (page.lines) {
          for (const line of page.lines) lines.push(line.content);
        }
      }
      extractedText = lines.join("\n");
    }
    processingStatus = extractedText.length > 0 ? "processed" : "empty";
    context.log(`[health-record-processor] OCR done. ${extractedText.length} chars extracted.`);
  } catch (err) {
    context.log.error("[health-record-processor] OCR failed:", err.message);
    processingStatus = "failed";
    extractedText = `OCR processing failed: ${err.message}`;
  }

  // ─── Step 2: Save / Update in Cosmos DB for MongoDB ──────────────────────
  try {
    await connectDB();

    // Convert string userId to ObjectId to match the API Gateway format
    const objectIdUserId = new mongoose.Types.ObjectId(userId);

    // Try to find an existing stub record (created by uploadController when the file was uploaded)
    const existingRecord = await MedicalRecord.findOne({ blobName: blobPath, userId: objectIdUserId });

    if (existingRecord) {
      // Update the existing stub record with OCR results
      existingRecord.extractedText = extractedText;
      existingRecord.processingStatus = processingStatus;
      await existingRecord.save();
      context.log("[health-record-processor] Updated existing record in Cosmos DB.");
    } else {
      // No stub found — create a new record (in case function ran before the API stub was saved)
      await MedicalRecord.create({
        userId: objectIdUserId,
        blobName: blobPath,
        blobUrl: blobUrl,
        title: `Uploaded: ${title}`,
        category: "Lab Report",
        description: `Auto-processed document uploaded by patient.`,
        date: processedAt.split("T")[0],
        extractedText: extractedText,
        processingStatus: processingStatus,
      });
      context.log("[health-record-processor] Created new record in Cosmos DB.");
    }
  } catch (err) {
    context.log.error("[health-record-processor] DB save failed:", err.message);
  }

  // ─── Step 3: Send Email via Azure Communication Services ─────────────────
  try {
    if (!ACS_CONNECTION_STRING || !ACS_SENDER_ADDRESS) {
      context.log.warn("[health-record-processor] ACS not configured. Skipping email.");
      return;
    }

    const emailClient = new EmailClient(ACS_CONNECTION_STRING);
    const statusLabel = processingStatus === "processed" ? "✅ Successfully Processed" : "⚠️ Processing Completed with Issues";

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0ea5e9, #14b8a6); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: #fff; margin: 0;">Aegis Health</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0;">AI-Powered Health Management</p>
        </div>
        <div style="padding: 30px; background: #fff; border: 1px solid #e2e8f0; border-top: none;">
          <h2 style="color: #1e293b;">Document Processing Complete</h2>
          <p style="color: #64748b;">Your health document has been processed by the Aegis AI engine.</p>
          <div style="background: #f8fafc; border-left: 4px solid #0ea5e9; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0; color: #475569;"><strong>File:</strong> ${filename}</p>
            <p style="margin: 5px 0 0; color: #475569;"><strong>Status:</strong> ${statusLabel}</p>
            <p style="margin: 5px 0 0; color: #475569;"><strong>Processed:</strong> ${new Date(processedAt).toLocaleString()}</p>
          </div>
          ${processingStatus === "processed" ? `
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0; font-size: 0.85rem; color: #166534;"><strong>Text Preview:</strong></p>
            <p style="margin: 8px 0 0; font-size: 0.8rem; color: #15803d; font-family: monospace; line-height: 1.6;">
              ${extractedText.substring(0, 300)}${extractedText.length > 300 ? "..." : ""}
            </p>
          </div>` : ""}
          ${blobUrl ? `<p><a href="${blobUrl}" style="background: #0ea5e9; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none;">View Original Document →</a></p>` : ""}
          <p style="color: #64748b; margin-top: 20px; font-size: 0.9rem;">
            View the full extracted text at your 
            <a href="${APP_BASE_URL}/patient/records" style="color: #0ea5e9;">Medical Records Dashboard</a>.
          </p>
        </div>
        <div style="padding: 15px; text-align: center; background: #f8fafc; border-radius: 0 0 10px 10px;">
          <p style="margin: 0; font-size: 0.75rem; color: #94a3b8;">Aegis Health — AI-Powered Patient & Caregiver Advisor</p>
        </div>
      </div>
    `;

    const toEmail = process.env.TEST_NOTIFICATION_EMAIL || "patient@example.com";

    const message = {
      senderAddress: ACS_SENDER_ADDRESS,
      recipients: {
        to: [{ address: toEmail }],
      },
      content: {
        subject: `Aegis Health: "${filename}" has been processed`,
        html: emailHtml,
      },
    };

    const sendPoller = await emailClient.beginSend(message);
    await sendPoller.pollUntilDone();
    context.log(`[health-record-processor] Email sent via ACS to ${toEmail}.`);
  } catch (err) {
    context.log.error("[health-record-processor] Email failed:", err.message);
  }
};
