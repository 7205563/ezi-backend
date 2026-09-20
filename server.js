const express = require('express');
const admin = require('firebase-admin');
const axios = require('axios');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

let db = null;
try {
  const raw = process.env.FIREBASE_KEY;
  const serviceAccount = JSON.parse(raw);
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  db = admin.firestore();
  console.log("Firebase OK ✅");
} catch (e) {
  console.log("Firebase Init Failed:", e.message);
}

app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === 'ezi123') return res.send(req.query['hub.challenge']);
  res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
  console.log(">>> WEBHOOK HIT <<<");
  try {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (msg && db) {
      const from = msg.from;
      let btn = msg.button?.text || msg.interactive?.button_reply?.title || msg.text?.body || "";
      console.log(`FROM: ${from} BTN: ${btn}`);
      const isAvail = btn.toLowerCase().includes('available') &&!btn.toLowerCase().includes('not');
      await db.collection('workers').doc(from).set({ phone: from, isAvailable: isAvail, lastUpdated: new Date() }, { merge: true });
    }
  } catch (e) { console.log(e.message); }
  res.sendStatus(200);
});

app.get('/send-daily', async (req, res) => {
  try {
    const url = `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`;
    await axios.post(url, {
      messaging_product: "whatsapp", to: "917206580660",
      type: "interactive",
      interactive: { type: "button", body: { text: "Hi 👋 Are you Available today?" }, action: { buttons: [{ type: "reply", reply: { id: "yes", title: "✅ Available" } }, { type: "reply", reply: { id: "no", title: "❌ Not Available" } }] } }
    }, { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` } });
    res.send("Sent OK DB:" + (db? "OK" : "FAIL"));
  } catch (e) { res.send(JSON.stringify(e.response?.data || e.message)); }
});

app.get('/', (req,res)=>res.send("Live DB:"+(db?"OK":"FAIL")));
app.listen(10000, ()=>console.log("Live 10000"));
