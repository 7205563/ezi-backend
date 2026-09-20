const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

let db = null;
let fbError = "Not init";
try {
  let keyStr = process.env.FIREBASE_KEY || "";
  let trimmed = keyStr.trim();
  if (!trimmed.startsWith("{")) {
    keyStr = Buffer.from(trimmed, 'base64').toString('utf-8');
    trimmed = keyStr.trim();
  }
  const parsed = JSON.parse(trimmed);
  const admin = require("firebase-admin");
  admin.initializeApp({ credential: admin.credential.cert(parsed) });
  db = admin.firestore();
  fbError = "OK";
  console.log("Firebase OK ✅");
} catch(e) {
  fbError = e.message;
  console.log("Firebase Fail:", e.message);
}

app.get('/', (req,res)=>{
  res.send(`Ezi Backend Live | DB:${fbError} | LEN:${(process.env.FIREBASE_KEY||'').length}`);
});

app.get('/send-daily', async (req,res)=>{
  if(!db) return res.send("DB not ready: "+fbError);
  // yahan tera purana daily reminder code ayega
  res.send("Daily check OK, DB: "+fbError);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=> console.log('Live', PORT));
