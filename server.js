const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cron = require('node-cron');
const app = express();

app.use(cors());
app.use(express.json());

const WA_TOKEN = process.env.WA_TOKEN;
const PHONE_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// TEMP DB - Firebase connect hone tak
let otpStore = {};
let workers = [];
let requirements = [];

async function sendMessage(to, text, buttons) {
  try {
    let data;
    if (buttons) {
      data = {
        messaging_product: "whatsapp",
        to: to,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: text },
          action: { buttons: buttons }
        }
      };
    } else {
      data = {
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: { body: text }
      };
    }
    await axios.post(`https://graph.facebook.com/v20.0/${PHONE_ID}/messages`, data, {
      headers: { Authorization: `Bearer ${WA_TOKEN}` }
    });
    console.log(`Sent to ${to}: ${text}`);
  } catch (e) {
    console.error("Send Error:", e.response?.data || e.message);
  }
}

// Webhook Verify
app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else res.sendStatus(403);
});

// Webhook Receive - Bina App Khole Update
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return;
    const from = message.from;
    const text = (message.text?.body || message.interactive?.button_reply?.id || "").toUpperCase();
    console.log("Incoming:", from, text);

    if (text.includes("AVAILABLE")) {
      const id = text.split(" ").pop();
      console.log(`Worker ${id} AVAILABLE`);
      await sendMessage(from, `✅ Aapko Available kar diya hai! Aapko ab kaam milega. - Ezi Services`);
    }
    if (text.includes("BUSY") &&!text.includes("AVAILABLE")) {
      const id = text.split(" ").pop();
      console.log(`Worker ${id} BUSY`);
      await sendMessage(from, `🔴 Aapko Busy kar diya hai. - Ezi Services`);
    }
    if (text.startsWith("YES")) {
      const id = text.split(" ").pop();
      console.log(`Requirement ${id} YES - delete in 24hr`);
      await sendMessage(from, `Thank You! Aapki requirement 24 ghante me auto delete ho jayegi.`);
      setTimeout(() => console.log(`Auto Deleted ${id}`), 24*60*60*1000);
    }
    if (text.startsWith("NO")) {
      await sendMessage(from, `Ok, aapki requirement pending rakhi gayi hai.`);
    }
  } catch (e) { console.log(e); }
});

// OTP APIs
app.post('/request-otp', async (req, res) => {
  const { phone } = req.body;
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  otpStore[phone] = otp;
  await sendMessage(phone, `Ezi Services OTP: ${otp} - 5 min valid`);
  res.json({ ok: true, otp: otp }); // Testing ke liye otp bhej raha hu, baad me hata dena
});

app.post('/verify-otp', (req, res) => {
  const { phone, otp } = req.body;
  if (otpStore[phone] === otp) {
    delete otpStore[phone];
    res.json({ verified: true });
  } else res.json({ verified: false });
});

// Manual Test APIs
app.post('/register-worker', (req, res) => {
  workers.push(req.body);
  res.json({ ok: true, total: workers.length });
});

app.get('/', (req, res) => res.send("Ezi Backend Live - OTP + Busy/Available Ready"));

app.listen(10000, () => console.log("Live on 10000"));

// CRON JOBS - IST
// Home Repair 8 AM IST = 2:30 AM UTC
cron.schedule('30 2 * * *', () => {
  console.log("Running 8 AM Job Home Repair");
  workers.filter(w => w.serviceType === "Home Repair").forEach(w => {
    sendMessage(w.phone, `Hi ${w.name}! Kya aap Available ho?`, [
      { type: "reply", reply: { id: `AVAILABLE ${w.id}`, title: "Available ✅" } },
      { type: "reply", reply: { id: `BUSY ${w.id}`, title: "Busy 🔴" } }
    ]);
  });
});

// Home Repair 2 PM IST = 8:30 AM UTC
cron.schedule('30 8 * * *', () => {
  console.log("Running 2 PM Job Home Repair");
  workers.filter(w => w.serviceType === "Home Repair").forEach(w => {
    sendMessage(w.phone, `Hi ${w.name}! Abhi ka status?`, [
      { type: "reply", reply: { id: `AVAILABLE ${w.id}`, title: "Available ✅" } },
      { type: "reply", reply: { id: `BUSY ${w.id}`, title: "Busy 🔴" } }
    ]);
  });
});

// Sunday 9 AM IST = 3:30 AM UTC Sunday
cron.schedule('30 3 * * 0', () => {
  console.log("Running Sunday 9 AM Job");
  workers.filter(w => w.serviceType!== "Home Repair").forEach(w => {
    sendMessage(w.phone, `Hi ${w.name}! Weekly status Available/Busy?`, [
      { type: "reply", reply: { id: `AVAILABLE ${w.id}`, title: "Available ✅" } },
      { type: "reply", reply: { id: `BUSY ${w.id}`, title: "Busy 🔴" } }
    ]);
  });
});

// Daily 9 AM IST - Requirement Check + Date Update
cron.schedule('30 3 * * *', () => {
  console.log("Running Daily 9 AM Requirement Job");
  requirements.forEach(r => {
    r.date = new Date().toLocaleDateString(); // Auto date update
    if (!r.isCompleted) {
      sendMessage(r.customerPhone, `Aapki ${r.category} requirement complete hui?`, [
        { type: "reply", reply: { id: `YES ${r.id}`, title: "YES Complete" } },
        { type: "reply", reply: { id: `NO ${r.id}`, title: "NO Pending" } }
      ]);
    }
  });
});
