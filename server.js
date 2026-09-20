const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cron = require('node-cron');
const admin = require('firebase-admin');

const app = express();
app.use(bodyParser.json());

// --- CONFIG ---
const VERIFY_TOKEN = "ezi123";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN; // Render > Environment me daal
const PHONE_NUMBER_ID = "810914716515743"; // Tera Phone Number ID
const FIRESTORE_SERVICE_ACCOUNT = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

if (Object.keys(FIRESTORE_SERVICE_ACCOUNT).length > 0) {
  admin.initializeApp({ credential: admin.credential.cert(FIRESTORE_SERVICE_ACCOUNT) });
}
const db = admin.firestore? admin.firestore() : null;

app.get('/', (req, res) => res.send('Ezi Backend Live hai ✅'));

// 1. Webhook Verify - Meta ke liye
app.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(403);
  }
});

// 2. WhatsApp Button Click ka Handle
app.post('/webhook', async (req, res) => {
  try {
    const entry = req.body.entry?.[0]?.changes?.[0]?.value;
    const message = entry?.messages?.[0];
    if (message?.type === 'button' || message?.type === 'interactive') {
      const from = message.from;
      const buttonText = message.button?.text || message.interactive?.button_reply?.title || "";
      console.log(`Button Click: ${from} -> ${buttonText}`);
      if (db) {
        // Worker status update bina app khole
        const workerRef = db.collection('workers').where('phone', '==', from);
        const snap = await workerRef.get();
        if (!snap.empty) {
           const isAvailable = buttonText.toLowerCase().includes('available') &&!buttonText.toLowerCase().includes('not');
           snap.forEach(doc => doc.ref.update({
             availability: isAvailable? 'Available' : 'Not Available',
             lastUpdatedFromWhatsApp: new Date()
           }));
        }
      }
      // Confirmation bhejo
      await sendWhatsApp(from, `Status Updated: ${buttonText} ✅`);
    }
  } catch (e) { console.error(e); }
  res.sendStatus(200);
});

// --- Helper to Send WhatsApp ---
async function sendWhatsApp(to, body, buttons) {
  try {
    let data;
    if (buttons) {
      data = {
        messaging_product: "whatsapp", to,
        type: "interactive",
        interactive: { type: "button", body: { text: body }, action: { buttons: buttons.map(b => ({ type: "reply", reply: { id: b, title: b } })) } }
      };
    } else {
      data = { messaging_product: "whatsapp", to, type: "text", text: { body } };
    }
    await axios.post(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, data, {
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' }
    });
    console.log(`Sent to ${to}`);
  } catch (err) { console.error(err.response?.data || err.message); }
}

// 3. TEST ROUTE - Ye ab kaam karega
app.get('/test-whatsapp', async (req, res) => {
  const number = req.query.number;
  if (!number) return res.send('?number=91XXXXXXXXXX daal');
  await sendWhatsApp(number, `EziService Test ✅\nAap available ho aaj?`, ["Available", "Not Available"]);
  res.send(`Test message sent to ${number}`);
});

// --- CRON JOBS ---
// Home Repair: 8AM & 2PM Daily
cron.schedule('0 8,14 * * *', async () => {
  if (!db) return;
  console.log('Running Home Repair 8AM/2PM job');
  // Yaha tera logic: workers jiska trade=HomeRepair unko message bhejo
});

// Home Care / Commercial: Sunday 9AM
cron.schedule('0 9 * * 0', async () => {
  console.log('Running Sunday 9AM job');
});

// Requirement: Daily 9AM + date update
cron.schedule('0 9 * * *', async () => {
  console.log('Running Requirement 9AM job - auto date update');
  if (db) {
    const today = new Date().toISOString().split('T')[0];
    // Example: requirements collection me date update
  }
});

// 24hr auto delete
cron.schedule('0 * * * *', async () => {
  if (!db) return;
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const old = await db.collection('workers').where('createdAt', '<', cutoff).get();
  old.forEach(doc => doc.ref.delete());
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server on ${PORT}`));
