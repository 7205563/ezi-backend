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
let workers = [{ id: 1, name: "Test Worker", phone: "919999999999", city: "Ferozepur-Jhirka", isAvailable: true }];

async function sendMessage(to, text, buttons) {
  console.log(`WhatsApp to ${to}: ${text}`);
  // Yaha tera WhatsApp API call ayega
}

// City nikalne ka function - GPS + IP
async function getCityFromLatLon(lat, lon) {
  try {
    const geo = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, {
      headers: { 'User-Agent': 'EziApp/2.0' }
    });
    const addr = geo.data.address;
    return addr.city || addr.town || addr.village || addr.block || addr.county || "Unknown";
  } catch (e) { return null; }
}

async function getCityFromIP(ip) {
  try {
    if (ip === "::1" || ip === "127.0.0.1" || ip.includes("::ffff:")) return "Ferozepur-Jhirka";
    const res = await axios.get(`http://ip-api.com/json/${ip}?fields=city`);
    return res.data.city || "Unknown";
  } catch (e) { return "Unknown"; }
}

app.get('/', (req, res) => res.send('Ezi Backend V2 LIVE - All India City Support'));

// --- CITY API ---
app.get('/get-city', async (req, res) => {
  const { lat, lon } = req.query;
  if (lat && lon) {
    const city = await getCityFromLatLon(lat, lon);
    return res.json({ city, source: "GPS", lat, lon });
  }
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  const city = await getCityFromIP(ip);
  res.json({ city, ip, source: "IP" });
});

// --- OTP WITH CITY ---
app.post('/send-otp', async (req, res) => {
  const { phone, city, lat, lon } = req.body;
  let finalCity = city;

  if (!finalCity && lat && lon) {
    finalCity = await getCityFromLatLon(lat, lon);
  }
  if (!finalCity) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
    finalCity = await getCityFromIP(ip);
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  users[phone] = { otp, city: finalCity, time: Date.now() };
  console.log(`OTP ${otp} for ${phone} CITY: ${finalCity}`);
  res.json({ success: true, otp, city: finalCity });
});

app.post('/verify-otp', (req, res) => {
  const { phone, otp } = req.body;
  if (users[phone]?.otp == otp) {
    res.json({ success: true, city: users[phone].city });
  } else {
    res.status(400).json({ error: "Invalid OTP" });
  }
});

// --- REQUIREMENT APIs ---
app.post('/add-requirement', (req, res) => {
  const r = {
    id: Date.now(),
   ...req.body,
    city: req.body.city || users[req.body.customerPhone]?.city || "Unknown",
    date: new Date().toLocaleDateString(),
    createdAt: Date.now(),
    isCompleted: false
  };
  requirements.push(r);
  res.json({ success: true, data: r });
});

app.get('/requirements', (req, res) => {
  const { city } = req.query;
  if (city) {
    return res.json(requirements.filter(r => r.city.toLowerCase() === city.toLowerCase()));
  }
  res.json(requirements);
});

app.get('/dashboard/:city', (req, res) => {
  const city = req.params.city;
  const filtered = requirements.filter(r => r.city.toLowerCase() === city.toLowerCase());
  res.json({ city, total: filtered.length, data: filtered });
});

// --- 8 AM & 2 PM - Available/Busy (bina app khole) ---
cron.schedule('30 2 * * *', () => { // 8 AM IST = 2:30 AM UTC
  console.log("8 AM Cron Running");
  workers.forEach(w => {
    sendMessage(w.phone, `Hi ${w.name} (${w.city}), Aaj Available ho?`, [
      { type: "reply", reply: { id: `AVAILABLE ${w.id}`, title: "Available 🟢" } },
      { type: "reply", reply: { id: `BUSY ${w.id}`, title: "Busy 🔴" } }
    ]);
  });
}, { timezone: "Asia/Kolkata" });

cron.schedule('30 8 * * *', () => { // 2 PM IST = 8:30 AM UTC
  console.log("2 PM Cron Running");
  workers.forEach(w => {
    sendMessage(w.phone, `Afternoon Check ${w.name}, Available ho?`, [
      { type: "reply", reply: { id: `AVAILABLE ${w.id}`, title: "Available 🟢" } },
      { type: "reply", reply: { id: `BUSY ${w.id}`, title: "Busy 🔴" } }
    ]);
  });
}, { timezone: "Asia/Kolkata" });

// --- 9 AM - Requirement Check + Auto Date Update ---
cron.schedule('30 3 * * *', () => { // 9 AM IST = 3:30 AM UTC
  console.log("9 AM Requirement Cron");
  requirements.forEach(r => {
    r.date = new Date().toLocaleDateString(); // Auto date update
    if (!r.isCompleted) {
      sendMessage(r.customerPhone, `Aapki ${r.category} requirement ${r.city} me complete hui?`, [
        { type: "reply", reply: { id: `YES ${r.id}`, title: "YES Complete" } },
        { type: "reply", reply: { id: `NO ${r.id}`, title: "NO Pending" } }
      ]);
    }
  });
}, { timezone: "Asia/Kolkata" });

// --- Auto 24hr Delete ---
setInterval(() => {
  const now = Date.now();
  const before = requirements.length;
  requirements = requirements.filter(r => (now - r.createdAt) < 24 * 60 * 60 * 1000);
  if (before!== requirements.length) console.log(`Auto Deleted ${before - requirements.length} requirements`);
}, 60 * 60 * 1000);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Ezi LIVE on " + PORT));
