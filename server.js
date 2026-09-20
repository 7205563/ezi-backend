const express = require('express');
const admin = require('firebase-admin');
const axios = require('axios');
const cors = require('cors');
const cron = require('node-cron');

const app = express();
app.use(cors());
app.use(express.json());

// Firebase
let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
} catch(e) {
  console.log("FIREBASE_KEY parse error", e.message);
}
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();
console.log("Firebase Connected");

// 1. Webhook Verify
app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === 'ezi123') {
    console.log("Webhook Verified!");
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(403);
  }
});

// 2. Webhook Receive - BUTTON CLICK
app.post('/webhook', async (req, res) => {
  console.log(">>> WEBHOOK HIT <<<");
  try {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (message) {
      const from = message.from;
      let btnText = "";
      if (message.button) btnText = message.button.text;
      if (message.interactive) btnText = message.interactive.button_reply?.title;
      if (message.text) btnText = message.text.body;

      console.log(`FROM: ${from} BTN: ${btnText}`);

      const isAvailable = btnText.toLowerCase().includes('available') &&!btnText.toLowerCase().includes('not');

      await db.collection('workers').doc(from).set({
        phone: from,
        isAvailable: isAvailable,
        lastUpdated: new Date()
      }, { merge: true });

      console.log(`Updated ${from} -> ${isAvailable}`);
    }
  } catch (err) {
    console.log("Webhook Error:", err.message);
  }
  res.sendStatus(200);
});

// 3. Send Daily Function
async function sendDailyMessages() {
  const workers = await db.collection('workers').get();
  // For testing, we will send to one number if no workers
  // yaha tera purana send logic tha
  console.log("Running sendDaily...");
  // Add your WhatsApp send API call here
  return "done";
}

app.get('/send-daily', async (req, res) => {
  try {
    // Simple test send to your number
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.PHONE_NUMBER_ID;
    const to = "917206580660"; // your number

    const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;
    await axios.post(url, {
      messaging_product: "whatsapp",
      to: to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: "Hi 👋 Are you Available for work today?" },
        action: {
          buttons: [
            { type: "reply", reply: { id: "yes", title: "✅ Available" } },
            { type: "reply", reply: { id: "no", title: "❌ Not Available" } }
          ]
        }
      }
    }, { headers: { Authorization: `Bearer ${token}` } });

    console.log(`Sent to ${to}`);
    res.send(`Sent to ${to} (test)`);
  } catch (e) {
    console.log(e.response?.data || e.message);
    res.send("Error: " + (e.response?.data? JSON.stringify(e.response.data) : e.message));
  }
});

app.get('/', (req, res) => res.send("Ezi Backend Live"));

app.listen(10000, () => console.log("Live on 10000"));
