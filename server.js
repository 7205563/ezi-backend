const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

let db = null;
let fbError = "Not init";

try {
  let keyStr = process.env.FIREBASE_KEY || "";
  console.log("ENV KEY LEN:", keyStr.length, "FIRST 20:", keyStr.substring(0,20));
  if (!keyStr) throw new Error("FIREBASE_KEY empty");
  let trimmed = keyStr.trim();
  if (!trimmed.startsWith("{")) {
    console.log("Trying Base64 decode...");
    keyStr = Buffer.from(trimmed, 'base64').toString('utf-8');
    console.log("After decode LEN:", keyStr.length);
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
  console.log("Firebase Init Failed:", e.message);
}

app.get('/', (req,res)=>{
  res.send(`Live 10000 | DB:${fbError} | KEY_LEN:${(process.env.FIREBASE_KEY||'').length}`);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=> console.log('Live', PORT));
