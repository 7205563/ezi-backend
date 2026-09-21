const express = require('express');
const axios = require('axios');
const cors = require('cors');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// --- IN-MEMORY DB (Live ke liye MongoDB lagana best hai) ---
let workers = {}; // { phone: {name, workType, status, lat, lon} }
let requirements = {}; // { reqId: {phone, category, date} }
let otpStore = {};
let contactUnlocks = {}; // { userPhone_workerPhone: timestamp }

const PHONE_ID = process.env.PHONE_NUMBER_ID;
const TOKEN = process.env.WHATSAPP_TOKEN;
const VERIFY_TOKEN = "ezi_verify_123";

// --- WhatsApp Sender ---
async function sendWhatsApp(to, payload) {
  try {
    await axios.post(`https://graph.facebook.com/v22.0/${PHONE_ID}/messages`, payload, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    console.log(`WhatsApp Sent to ${to}`);
  } catch (e) {
    console.log("WA Error:", e.response?.data || e.message);
  }
}

app.get('/', (req, res) => res.send('Ezi Backend Live with All Features! - 9/9 Active'));

// --- TEST ROUTES (Abhi test karne ke liye) ---
app.get('/test-busy', (req, res) => {
  const phone = req.query.phone;
  if (!phone) return res.send("?phone=7206376803 lagao");
  sendWhatsApp("91" + phone, {
    messaging_product: "whatsapp", to: "91" + phone, type: "interactive",
    interactive: { type: "button", body: { text: `Hi Partner! Ezi Services\nAap abhi Available ho ya Busy?` }, action: { buttons: [{ type: "reply", reply: { id: `AVAILABLE_${phone}`, title: "✅ Available" } }, { type: "reply", reply: { id: `BUSY_${phone}`, title: "❌ Busy" } }] } }
  });
  res.send(`Busy/Available WhatsApp ${phone} ko bhej diya! WhatsApp check karo`);
});

app.get('/test-req', (req, res) => {
  const phone = req.query.phone;
  if (!phone) return res.send("?phone=7206376803 lagao");
  const fakeId = Date.now().toString();
  requirements[fakeId] = { phone, category: "Plumber", date: new Date() };
  sendWhatsApp("91" + phone, {
    messaging_product: "whatsapp", to: "91" + phone, type: "interactive",
    interactive: { type: "button", body: { text: `Aapki Plumber requirement complete ho gayi?` }, action: { buttons: [{ type: "reply", reply: { id: `YES_${fakeId.slice(0, 8)}`, title: "✅ YES" } }, { type: "reply", reply: { id: `NO_${fakeId.slice(0, 8)}`, title: "❌ NO" } }] } }
  });
  res.send(`Requirement check ${phone} ko bhej diya!`);
});

// --- 1. LOGIN WITH WHATSAPP OTP ---
app.post('/send-otp', async (req, res) => {
  const { phone } = req.body;
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  otpStore[phone] = otp;
  console.log(`OTP ${phone}: ${otp}`);
  await sendWhatsApp("91" + phone, {
    messaging_product: "whatsapp", to: "91" + phone, type: "text",
    text: { body: `Ezi Services OTP: ${otp}\nValid for 5 min.` }
  });
  res.json({ success: true, otp }); // Testing ke liye otp bhi bhej raha hu
});

app.post('/verify-otp', (req, res) => {
  const { phone, otp } = req.body;
  if (otpStore[phone] === otp) { delete otpStore[phone]; return res.json({ success: true }); }
  res.json({ success: false, message: "Galat OTP" });
});

// --- 2. REGISTER + AUTO LOCATION ---
app.post('/register-worker', (req, res) => {
  const { phone, name, workType, lat, lon } = req.body;
  workers[phone] = { name, workType, lat, lon, status: 'Available', lastUpdate: new Date() };
  console.log(`Worker Registered: ${name} - ${workType} - ${lat},${lon}`);
  res.json({ success: true });
});

// --- 3. POST REQUIREMENT ---
app.post('/post-requirement', (req, res) => {
  const reqId = Date.now().toString();
  const { phone, category } = req.body;
  requirements[reqId] = { phone, category, date: new Date(), paid: false };
  console.log(`Requirement Posted: ${category} by ${phone}`);
  res.json({ success: true, reqId });
});

// --- 4. AFTER PAY - 24hr Unlock ---
app.post('/after-pay', (req, res) => {
  const { userPhone, workerPhone } = req.body;
  const key = `${userPhone}_${workerPhone}`;
  contactUnlocks[key] = Date.now();
  res.json({ success: true, message: "Number 24hr ke liye unlocked" });
});

// --- 5. WEBHOOK FOR BUTTON CLICK (Bina App Khole) ---
app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === VERIFY_TOKEN) res.send(req.query['hub.challenge']);
  else res.sendStatus(403);
});

app.post('/webhook', (req, res) => {
  const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) return res.sendStatus(200);

  const from = message.from.replace("91", "");
  const buttonId = message.button?.payload || message.interactive?.button_reply?.id;
  if (!buttonId) return res.sendStatus(200);

  console.log(`Button Clicked: ${buttonId} from ${from}`);

  if (buttonId.startsWith("AVAILABLE_") || buttonId.startsWith("BUSY_")) {
    const status = buttonId.startsWith("AVAILABLE")? "Available" : "Busy";
    if (workers[from]) workers[from].status = status;
    sendWhatsApp(message.from, { messaging_product: "whatsapp", to: message.from, type: "text", text: { body: `Done! Aapki profile ${status} kar di gayi hai ✅` } });
  }

  if (buttonId.startsWith("YES_")) {
    const shortId = buttonId.replace("YES_", "");
    const fullId = Object.keys(requirements).find(id => id.startsWith(shortId));
    if (fullId) delete requirements[fullId];
    sendWhatsApp(message.from, { messaging_product: "whatsapp", to: message.from, type: "text", text: { body: "Great! Requirement delete kar di gayi." } });
  }

  if (buttonId.startsWith("NO_")) {
    const shortId = buttonId.replace("NO_", "");
    const fullId = Object.keys(requirements).find(id => id.startsWith(shortId));
    if (fullId) requirements[fullId].date = new Date();
    sendWhatsApp(message.from, { messaging_product: "whatsapp", to: message.from, type: "text", text: { body: "Ok, hum aapki post ko active rakhenge. Date update ho gayi." } });
  }

  res.sendStatus(200);
});

// --- CRON JOBS ---

// Home Repair - 8AM & 2PM Daily
cron.schedule('0 8,14 * * *', () => {
  console.log("Running 8AM & 2PM Job");
  Object.keys(workers).forEach(phone => {
    if (workers[phone].workType === "Home Repair") {
      sendWhatsApp("91" + phone, {
        messaging_product: "whatsapp", to: "91" + phone, type: "interactive",
        interactive: { type: "button", body: { text: `Hi ${workers[phone].name}! Ezi Services\nAap abhi Available ho ya Busy?` }, action: { buttons: [{ type: "reply", reply: { id: `AVAILABLE_${phone}`, title: "✅ Available" } }, { type: "reply", reply: { id: `BUSY_${phone}`, title: "❌ Busy" } }] } }
      });
    }
  });
}, { timezone: "Asia/Kolkata" });

// Home Care & Commercial - Sunday 9AM
cron.schedule('0 9 * * 0', () => {
  console.log("Running Sunday 9AM Job");
  Object.keys(workers).forEach(phone => {
    if (["Home Care", "Commercial Hiring"].includes(workers[phone].workType)) {
      sendWhatsApp("91" + phone, {
        messaging_product: "whatsapp", to: "91" + phone, type: "interactive",
        interactive: { type: "button", body: { text: `Hi ${workers[phone].name}! Sunday Check\nAap Available ho?` }, action: { buttons: [{ type: "reply", reply: { id: `AVAILABLE_${phone}`, title: "✅ Available" } }, { type: "reply", reply: { id: `BUSY_${phone}`, title: "❌ Busy" } }] } }
      });
    }
  });
}, { timezone: "Asia/Kolkata" });

// Requirement Check - Daily 9AM
cron.schedule('0 9 * * *', () => {
  console.log("Running Daily 9AM Requirement Job");
  Object.keys(requirements).forEach(reqId => {
    const r = requirements[reqId];
    sendWhatsApp("91" + r.phone, {
      messaging_product: "whatsapp", to: "91" + r.phone, type: "interactive",
      interactive: { type: "button", body: { text: `Aapki ${r.category} requirement complete ho gayi?` }, action: { buttons: [{ type: "reply", reply: { id: `YES_${reqId.slice(0, 8)}`, title: "✅ YES" } }, { type: "reply", reply: { id: `NO_${reqId.slice(0, 8)}`, title: "❌ NO" } }] } }
    });
  });
}, { timezone: "Asia/Kolkata" });

// 24hr Auto Delete - Har Ghante Check
cron.schedule('0 * * * *', () => {
  Object.keys(contactUnlocks).forEach(key => {
    if (Date.now() - contactUnlocks[key] > 24 * 60 * 60 * 1000) {
      delete contactUnlocks[key];
      console.log(`Contact ${key} auto deleted after 24hr`);
    }
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Ezi All-in-One Running on ${PORT}`));
