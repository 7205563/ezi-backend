const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = "ezi123";

// --- FIREBASE SETUP - FINAL FIXED ---
let db = null;
try {
  let serviceAccount;
  const envData = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (envData.trim().startsWith('{')) {
    // Direct JSON
    serviceAccount = JSON.parse(envData);
  } else {
    // Base64 se decode
    const jsonStr = Buffer.from(envData, 'base64').toString('utf8');
    serviceAccount = JSON.parse(jsonStr);
  }

  // Private key ka \n fix karna zaroori hai
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  db = admin.firestore();
  console.log("✅ Firebase Connected Successfully");
} catch (e) {
  console.log("⚠️ Firebase not connected:", e.message);
}

app.get('/health', (req, res) => res.status(200).send('Ezi Server is Awake'));

app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  try {
    const value = req.body.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    if (!message) return res.sendStatus(200);

    const buttonId = message.interactive?.button_reply?.id || "";
    console.log("Button Clicked:", buttonId);
    if (!db) return res.sendStatus(200);

    if (buttonId.startsWith("AVAILABLE_")) {
      const workerId = buttonId.replace("AVAILABLE_", "");
      await db.collection("workers").doc(workerId).update({
        status: "Available",
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    if (buttonId.startsWith("BUSY_")) {
      const workerId = buttonId.replace("BUSY_", "");
      await db.collection("workers").doc(workerId).update({
        status: "Busy",
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    if (buttonId.startsWith("YES_")) {
      const reqId = buttonId.replace("YES_", "");
      await db.collection("requirements").doc(reqId).delete();
    }
  } catch (err) {
    console.log("Webhook Error:", err.message);
  }
  res.sendStatus(200);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Ezi Server Running on port ${PORT}`));
