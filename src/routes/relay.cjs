const { initializeApp, cert } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const { exec } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const DATABASE_URL = process.env.FIREBASE_DATABASE_URL || "https://sree-kumaran-edge-default-rtdb.firebaseio.com";

const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");

if (!fs.existsSync(serviceAccountPath)) {
  console.error("ERROR: serviceAccountKey.json not found at:", serviceAccountPath);
  console.error("Please ensure the Firebase Admin SDK service account key is present.");
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

const app = initializeApp({
  credential: cert(serviceAccount),
  databaseURL: DATABASE_URL,
});

const db = getDatabase(app);
const printRef = db.ref("print_jobs");
const processing = new Set();

function printReceipt(html) {
  return new Promise((resolve, reject) => {
    const tempPath = path.join(os.tmpdir(), `kumaran-receipt-${Date.now()}.html`);
    fs.writeFileSync(tempPath, html, "utf8");

    const escapedPath = tempPath.replace(/'/g, "''");
    const command = `powershell -NoProfile -Command "Start-Process -FilePath '${escapedPath}' -Verb Print"`;

    console.log(`Executing print command for: ${tempPath}`);
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error("Print command error:", error);
        console.error("stderr:", stderr);
        reject(error);
        return;
      }
      
      console.log("Print command executed successfully");
      
      setTimeout(() => {
        try {
          fs.unlinkSync(tempPath);
          console.log(`Temp file cleaned up: ${tempPath}`);
        } catch (cleanupError) {
          console.warn("Temp file cleanup failed (non-critical):", cleanupError.message);
        }
      }, 30_000);

      resolve();
    });
  });
}

async function handleJob(snapshot) {
  const jobId = snapshot.key;
  if (!jobId || processing.has(jobId)) return;

  const data = snapshot.val();
  if (!data?.receipt_html || data.status !== "pending") {
    console.log(`Skipping job ${jobId}: missing receipt_html or not pending status`);
    return;
  }

  processing.add(jobId);
  console.log(`[${new Date().toISOString()}] New print job detected (${jobId}) from outlet: ${data.outlet_name}`);

  try {
    await printReceipt(data.receipt_html);
    await snapshot.ref.remove();
    console.log(`[${new Date().toISOString()}] Job ${jobId} printed successfully and removed from queue`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Printer error for job ${jobId}:`, error.message);
    
    try {
      await snapshot.ref.update({ status: "failed", error: error.message });
      console.log(`[${new Date().toISOString()}] Job ${jobId} marked as failed in Firebase`);
    } catch (updateError) {
      console.error(`[${new Date().toISOString()}] Failed to update job status:`, updateError.message);
    }
  } finally {
    processing.delete(jobId);
  }
}

console.log(`[${new Date().toISOString()}] Printer relay started`);
console.log(`Listening on: ${DATABASE_URL}/print_jobs`);
console.log("Waiting for print jobs...");

printRef.on("child_added", (snapshot) => {
  void handleJob(snapshot);
});

printRef.on("error", (error) => {
  console.error("Firebase database error:", error);
});

process.on("SIGINT", () => {
  console.log("\nShutting down printer relay...");
  process.exit(0);
});
