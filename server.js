const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

let users = {};
let requirements = [];
let workers = [{ id: 1, name: "Test Worker", phone: "919999999999" }];

async function sendMessage(to, text, buttons) {
  console.log(`Message to ${to}: ${text}`, buttons);
  // WhatsApp API code yahan ayega - abhi console me hi dikhega
}

app.get('/', (req, res) => {
  res.send('Ezi Backend Live - V2 Ready');
});

// OTP APIs
app.post('/send-otp', (req, res) => {
  const { phone } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  users[phone] = otp;
  res.json({ success: true, otp });
});

app.post('/verify-otp', (req, res) => {
  const { phone, otp } = req.body;
  if (users[phone] == otp) res.json({ success: true });
  else res.status(400).json({ error: "Invalid" });
});

// Requirement APIs
app.post('/add-requirement', (req, res) => {
  const r = { id: Date.now(),...req.body, date: new Date().toLocaleDateString(), isCompleted: false };
  requirements.push(r);
  res.json({ success: true, data: r });
});

app.get('/requirements', (req, res) => {
  res.json(requirements);
});

// Worker Available/Busy - 8 AM & 2 PM IST (2:30 AM & 8:30 AM UTC)
cron.schedule('30 2 * * *', () => {
  workers.forEach(w => {
    sendMessage(w.phone, `Hi ${w.name}, Are you Available today?`, [
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

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Live on " + PORT));
