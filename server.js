const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());
app.set('trust proxy', true);

let users = {}; // phone -> {otp, city}
let requirements = [];
let workers = [{ id: 1, name: "Test Worker", phone: "919999999999", city: "Ferozepur-Jhirka" }];

async function sendMessage(to, text, buttons) {
  console.log(`Message to ${to}: ${text}`);
}

async function getCityFromIP(ip) {
  try {
    // Render ka IP local hota hai, isliye real IP ke liye header
    if (ip === "::1" || ip === "127.0.0.1") return "Ferozepur-Jhirka";
    const res = await axios.get(`http://ip-api.com/json/${ip}?fields=city`);
    return res.data.city || "Unknown";
  } catch (e) {
    return "Unknown";
  }
}

app.get('/', (req, res) => {
  res.send('Ezi Backend Live - V2 Ready + City Filter');
});

// NEW API - City detect
app.get('/get-city', async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  const city = await getCityFromIP(ip);
  res.json({ city, ip });
});

// OTP APIs with CITY
app.post('/send-otp', async (req, res) => {
  const { phone, city } = req.body;
  let finalCity = city;
  if (!finalCity) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
    finalCity = await getCityFromIP(ip);
  }
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  users[phone] = { otp, city: finalCity };
  console.log(`OTP ${otp} for ${phone} city: ${finalCity}`);
  res.json({ success: true, otp, city: finalCity });
});

app.post('/verify-otp', (req, res) => {
  const { phone, otp } = req.body;
  if (users[phone]?.otp == otp) {
    res.json({ success: true, city: users[phone].city });
  } else {
    res.status(400).json({ error: "Invalid" });
  }
});

// Requirement APIs - City wise
app.post('/add-requirement', (req, res) => {
  const r = {
    id: Date.now(),
   ...req.body,
    city: req.body.city || users[req.body.customerPhone]?.city || "Unknown",
    date: new Date().toLocaleDateString(),
    isCompleted: false
  };
  requirements.push(r);
  res.json({ success: true, data: r });
});

app.get('/requirements', (req, res) => {
  const { city } = req.query;
  if (city) {
    const filtered = requirements.filter(r => r.city.toLowerCase() === city.toLowerCase());
    return res.json(filtered);
  }
  res.json(requirements);
});

// Dashboard API - City wise
app.get('/dashboard/:city', (req, res) => {
  const city = req.params.city;
  const cityReq = requirements.filter(r => r.city.toLowerCase() === city.toLowerCase());
  res.json({ city, total: cityReq.length, data: cityReq });
});

// Cron Jobs (Same as before)
cron.schedule('30 2 * * *', () => {
  workers.forEach(w => {
    sendMessage(w.phone, `Hi ${w.name} (${w.city}), Available today?`, [
      { type: "reply", reply: { id: `AVAILABLE ${w.id}`, title: "Available 🟢" } },
      { type: "reply", reply: { id: `BUSY ${w.id}`, title: "Busy 🔴" } }
    ]);
  });
});

cron.schedule('30 8 * * *', () => {
  workers.forEach(w => {
    sendMessage(w.phone, `Afternoon Check - Available?`, [
      { type: "reply", reply: { id: `AVAILABLE ${w.id}`, title: "Available 🟢" } },
      { type: "reply", reply: { id: `BUSY ${w.id}`, title: "Busy 🔴" } }
    ]);
  });
});

cron.schedule('30 3 * * *', () => {
  requirements.forEach(r => {
    r.date = new Date().toLocaleDateString();
    if (!r.isCompleted) {
      sendMessage(r.customerPhone, `Aapki ${r.category} requirement complete hui?`, [
        { type: "reply", reply: { id: `YES ${r.id}`, title: "YES Complete" } },
        { type: "reply", reply: { id: `NO ${r.id}`, title: "NO Pending" } }
      ]);
    }
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Live on " + PORT));
