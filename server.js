const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

let db = null;
let fbError = "Not init";
try {
  let keyStr = process.env.FIREBASE_KEY || "";
  console.log("KEY LEN:", keyStr.length);
  // Agar Base64 hai to decode karo
  if (keyStr && !keyStr.trim().startsWith("{")) {
    keyStr = Buffer.from(keyStr.trim(), 'base64').toString('utf-8');
    console.log("Decoded from Base64, new len:", keyStr.length);
  }
  const parsed = JSON.parse(keyStr);
  const admin = require("firebase-admin");
  admin.initializeApp({ credential: admin.credential.cert(parsed) });
  db = admin.firestore();
  fbError = "OK";
  console.log("Firebase OK ✅");
} catch(e) {
  fbError = e.message;
  console.log("Firebase Init Failed:", e.message);
}
