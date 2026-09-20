const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());
app.set('trust proxy', true);
app.get("/", (req, res) => {
  res.send("Ezi Backend Live hai ✅");
});

let users = {}; // phone -> {otp, city}
let requirements = [];
let workers = [{ id: 1, name: "Test Worker", phone: "919999999999", city: "Panipat", serviceType: "Home Repair", isAvailable: true, lastUpdate: Date.now() }];

const WHATSAPP_PHONE_ID = "1316526978211496";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

async function sendMessage(to, text, buttons) {
  try {
    let data;
    if (buttons && buttons.length > 0) {
      // Interactive button - Available / Busy / Yes / No
      data = {
        messaging_product: "whatsapp",
        to: to,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: text },
          action: { buttons: buttons.map(b => ({ type: "reply", reply: { id: b.id, title: b.title } })) }
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
    await axios.post(`https://graph.facebook.com/v22.0/${WHATSAPP_PHONE_ID}/messages`, data, {
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" }
    });
    console.log(`Sent to ${to}`);
  } catch (e) { console.log(e.response?.data || e.message); }
}

// 1. Login OTP
app.post("/send-otp", async (req, res) => {
  const { phone } = req.body;
  const otp = Math.floor(1000 + Math.random() * 9000);
  users[phone] = { otp, city: users[phone]?.city || "Panipat" };
  await sendMessage(`91${phone}`, `Ezi Services OTP: ${otp}`);
  res.json({ success: true });
});

// Webhook verify
app.get("/webhook", (req, res) => {
  if (req.query["hub.verify_token"] === "ezi123") res.send(req.query["hub.challenge"]);
  else res.sendStatus(403);
});

// Webhook receiver - Bina App Khole Auto Update
app.post("/webhook", (req, res) => {
  const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (msg) {
    const id = msg.interactive?.button_reply?.id || "";
    const from = msg.from;
    console.log("Click:", id, from);
    if (id.startsWith("AVAILABLE_")) {
      let wid = id.split("_")[1];
      workers = workers.map(w => w.id == wid ? { ...w, isAvailable: true, lastUpdate: Date.now() } : w);
    }
    if (id.startsWith("BUSY_")) {
      let wid = id.split("_")[1];
      workers = workers.map(w => w.id == wid ? { ...w, isAvailable: false, lastUpdate: Date.now() } : w);
    }
    if (id.startsWith("YES_")) {
      let shortId = id.split("_")[1];
      requirements = requirements.filter(r => !r.id.includes(shortId));
    }
  }
  res.sendStatus(200);
});

// 2. Home Repair 8AM & 2PM IST
cron.schedule("0 8 * * *", () => {
  console.log("8AM Job");
  workers.filter(w => w.serviceType === "Home Repair").forEach(w => {
    sendMessage(w.phone, `Hi ${w.name}! Ezi Services\nAap abhi Available ho ya Busy?`, [{ id: `AVAILABLE_${w.id}`, title: "✅ Available" }, { id: `BUSY_${w.id}`, title: "❌ Busy" }]);
  });
}, { timezone: "Asia/Kolkata" });

cron.schedule("0 14 * * *", () => {
  workers.filter(w => w.serviceType === "Home Repair").forEach(w => {
    sendMessage(w.phone, `Hi ${w.name}! Ezi Services\nAap abhi Available ho ya Busy?`, [{ id: `AVAILABLE_${w.id}`, title: "✅ Available" }, { id: `BUSY_${w.id}`, title: "❌ Busy" }]);
  });
}, { timezone: "Asia/Kolkata" });

// 3. Home Care & Commercial - Sunday 9AM
cron.schedule("0 9 * * 0", () => {
  workers.filter(w => w.serviceType !== "Home Repair").forEach(w => {
    sendMessage(w.phone, `Hi ${w.name}! Sunday ke liye Available ho?`, [{ id: `AVAILABLE_${w.id}`, title: "✅ Available" }, { id: `BUSY_${w.id}`, title: "❌ Busy" }]);
  });
}, { timezone: "Asia/Kolkata" });

// 4. Requirement Daily 9AM + Date Auto Update + 24hr Auto Delete
cron.schedule("0 9 * * *", () => {
  requirements.forEach(r => {
    if (!r.isCompleted) {
      sendMessage(r.customerPhone, `Aapki ${r.category} requirement complete ho gayi?`, [{ id: `YES_${r.id.slice(0, 8)}`, title: "✅ YES" }, { id: `NO_${r.id.slice(0, 8)}`, title: "❌ NO" }]);
      r.lastUpdated = Date.now(); // Date auto update
    }
  });
  // 24hr baad number delete
  const now = Date.now();
  requirements = requirements.filter(r => now - r.paidAt < 24 * 60 * 60 * 1000 || !r.paidAt);
}, { timezone: "Asia/Kolkata" });

app.listen(3000, () => console.log("Server running"));
