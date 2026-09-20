const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// Firebase
let db = null;
try {
  if(process.env.FIREBASE_SERVICE_ACCOUNT){
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    db = admin.firestore();
    console.log("Firebase Connected");
  }
} catch(e){ console.log("Firebase Error", e.message); }

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "ezi123";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || "1316526978211496";

app.get('/', (req,res)=> res.send('Running OK - ezi-services-d4d68'));

 // === YAHI MISSING THA - ISILYE CANNOT GET AA RAHA THA ===
app.get('/webhook', (req,res)=>{
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if(mode && token && mode === 'subscribe' && token === VERIFY_TOKEN){
    console.log("WEBHOOK VERIFIED!");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

app.post('/webhook', async (req,res)=>{
  try{
    const value = req.body.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    const buttonId = message?.interactive?.button_reply?.id || message?.button?.payload;
    if(buttonId && db){
      const [status, docId] = buttonId.split("_");
      await db.collection("workers").doc(docId).update({
        availability: status === "available"? "Available" : "Busy",
        isAvailable: status === "available",
        lastUpdated: new Date()
      });
      console.log(`Updated ${docId} -> ${status}`);
    }
  }catch(e){ console.log("Webhook POST Error", e.message); }
  res.sendStatus(200);
});

// Daily send
app.get('/send-daily', async (req,res)=>{
  try{
    const snapshot = await db.collection("workers").get();
    let count = 0;
    for(const doc of snapshot.docs){
      const w = doc.data();
      let phone = (w.phone || "").replace(/\D/g,'');
      if(phone.length===10) phone = "91"+phone;
      if(!phone) continue;
      await axios.post(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
        messaging_product: "whatsapp", to: phone,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: `Hi ${w.name || 'Worker'}! Aaj available ho?` },
          action: { buttons: [
            { type: "reply", reply: { id: `available_${doc.id}`, title: "✅ Available" } },
            { type: "reply", reply: { id: `busy_${doc.id}`, title: "❌ Busy" } }
          ]}
        }
      }, { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } });
      count++;
    }
    res.send(`Daily Sent ${count}`);
  }catch(e){ console.log(e.response?.data || e.message); res.status(500).send(e.message); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=> console.log("Server on "+PORT));
