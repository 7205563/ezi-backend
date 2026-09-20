const express = require('express');
const admin = require('firebase-admin');
const axios = require('axios');
const app = express();

app.use(express.json());

// FIREBASE SETUP
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
console.log("Firebase Connected ✅");

// WEBHOOK VERIFY (GET)
app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === 'ezi123') {
    return res.send(req.query['hub.challenge']);
  }
  res.sendStatus(403);
});

// WEBHOOK RECEIVE (POST) - YEHI MISSING THA
app.post('/webhook', async (req, res) => {
  console.log("WEBHOOK HIT:", JSON.stringify(req.body).substring(0, 500));

  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const msg = value?.messages?.[0];

    if (msg) {
      const from = msg.from;
      const btn = msg.button?.text || msg.interactive?.button_reply?.title || msg.text?.body;
      console.log(`FROM: ${from} BTN: ${btn}`);

      const isAvailable = btn?.toLowerCase().includes('available') &&!btn?.toLowerCase().includes('not');

      if (from) {
        await db.collection('workers').doc(from).set({
          isAvailable: isAvailable? true : false,
          lastUpdated: new Date(),
          phone: from
        }, { merge: true });
        console.log(`Updated ${from} -> ${isAvailable}`);
      }
    }
  } catch (e) {
    console.log("Webhook error:", e.message);
  }
  res.sendStatus(200);
});

// SEND DAILY
app.get('/send-daily', async (req, res) => {
  // Tera existing send logic yaha rehne de
  //...
  res.send("Sent");
});

app.listen(10000, () => console.log("Live on 10000"));
