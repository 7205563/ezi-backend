const express = require("express");
const admin = require("firebase-admin");
const axios = require("axios");
const app = express();

app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "ezi123";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || "1316526978211496";

// Firebase - dono naam aur base64 support
let db = null;
try {
  const fbRaw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_KEY;
  if(fbRaw){
    let jsonStr = fbRaw.trim();
    try { JSON.parse(jsonStr); }
    catch(e) { jsonStr = Buffer.from(jsonStr, 'base64').toString('utf-8'); }
    const serviceAccount = JSON.parse(jsonStr);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    db = admin.firestore();
    console.log("Firebase Connected");
  }
} catch(e){ console.log("Firebase Error", e.message); }

app.get("/", (req,res) => res.send("Ezi Backend Live"));

app.get("/webhook", (req,res) => {
  if(req.query["hub.verify_token"] === VERIFY_TOKEN){
    res.send(req.query["hub.challenge"]);
  } else res.sendStatus(403);
});

app.post("/webhook", async (req,res) => {
  try {
    console.log("WEBHOOK AAYA:", JSON.stringify(req.body).substring(0,500));
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const msg = value?.messages?.[0];

    if(msg){
      const from = msg.from;
      const buttonId = msg.interactive?.button_reply?.id || msg.button?.payload || msg.interactive?.button_reply?.title;
      console.log(`From: ${from}, Button: ${buttonId}`);

      if(buttonId && db){
        let status = buttonId.toLowerCase().includes("not") || buttonId.toLowerCase().includes("busy")? "Busy" : "Available";
        // workers collection me phone se dhoond ke update
        const snap = await db.collection("workers").where("phone","==", from).get();
        if(!snap.empty){
          for(const doc of snap.docs){
            await doc.ref.update({ availability: status, isAvailable: status === "Available", lastUpdate: new Date().toISOString() });
            console.log(`Updated ${doc.id} -> ${status}`);
          }
        } else {
          // agar +91 ke bina hai to +91 add karke try
          const snap2 = await db.collection("workers").where("phone","==", from.replace("91","")).get();
          console.log("Retry snap2 size:", snap2.size);
        }
      }
    }
    res.sendStatus(200);
  } catch(e){ console.log("Webhook Error", e.message); res.sendStatus(200); }
});

app.get("/send-daily", async (req,res) => {
  try{
    const snapshot = await db.collection("workers").get();
    let count = 0;
    for(const doc of snapshot.docs){
      const w = doc.data();
      let phone = w.phone;
      if(!phone) continue;
      if(!phone.startsWith("91")) phone = "91"+phone;

      await axios.post(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
        messaging_product: "whatsapp",
        to: phone,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: `Hi ${w.name || 'Worker'}! Aaj available ho?` },
          action: { buttons: [{type:"reply", reply:{id:"available", title:"✅ Available"}}, {type:"reply", reply:{id:"not_available", title:"❌ Busy"}}] }
        }
      }, { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type":"application/json" } });
      count++;
    }
    res.send(`Daily Sent ${count}`);
  } catch(e){ res.status(500).send(e.message); }
});

app.listen(process.env.PORT || 10000, ()=> console.log("Server on 10000"));
