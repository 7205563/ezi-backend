const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const app = express();

app.use(bodyParser.json());

// --- CONFIG ---
const VERIFY_TOKEN = "ezi_verify_123";

// --- FIREBASE SETUP ---
let db = null;
try {
  // Render me FIREBASE_SERVICE_ACCOUNT naam se poora JSON dalo
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  db = admin.firestore();
  console.log("✅ Firebase Connected");
} catch (e) {
  console.log("⚠️ Firebase not connected:", e.message);
}

// 1. Render ko jagaye rakhne ke liye
app.get('/health', (req, res) => {
  res.status(200).send('Ezi Server is Awake');
});

// 2. Webhook Verify - Meta ke liye
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token === VERIFY_TOKEN) {
    console.log("WEBHOOK VERIFIED");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// 3. Main Webhook - Button Click
app.post('/webhook', async (req, res) => {
  try {
    const value = req.body.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];

    if (!message) return res.sendStatus(200);

    const buttonId = message.interactive?.button_reply?.id || "";
    console.log("Button Clicked:", buttonId);

    if (!db) return res.sendStatus(200);

    // AVAILABLE
    if (buttonId.startsWith("AVAILABLE_")) {
      const workerId = buttonId.replace("AVAILABLE_", "");
      await db.collection("workers").doc(workerId).update({
        status: "Available",
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`Worker ${workerId} -> Available`);
    }

    // BUSY
    if (buttonId.startsWith("BUSY_")) {
      const workerId = buttonId.replace("BUSY_", "");
      await db.collection("workers").doc(workerId).update({
        status: "Busy",
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`Worker ${workerId} -> Busy`);
    }

    // YES - Requirement Delete
    if (buttonId.startsWith("YES_")) {
      const reqId = buttonId.replace("YES_", "");
      await db.collection("requirements").doc(reqId).delete();
      console.log(`Requirement ${reqId} DELETED`);
    }

  } catch (err) {
    console.log("Webhook Error:", err.message);
  }
  res.sendStatus(200);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Ezi Server Running on port ${PORT}`);
});
