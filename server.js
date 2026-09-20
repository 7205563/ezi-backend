const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');
const cron = require('node-cron');
const app = express();
app.use(express.json());

// Firebase Connect
try {
  const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(svc) });
  console.log("Firebase Connected ✅");
} catch(e){
  console.log("Firebase not set:", e.message);
}
const db = admin.apps.length? admin.firestore() : null;

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "ezi123";
const TOKEN = process.env.WHATSAPP_TOKEN || process.env.ACCESS_TOKEN;
const PHONE_ID = process.env.PHONE_NUMBER_ID || "1316526978211496";

async function sendAvailability(to){
  return axios.post(`https://graph.facebook.com/v20.0/${PHONE_ID}/messages`, {
    messaging_product: "whatsapp",
    to: to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "Hi 👋 Are you Available for work today?" },
      action: { buttons: [
        { type: "reply", reply: { id: "Available", title: "✅ Available" } },
        { type: "reply", reply: { id: "Not_Available", title: "❌ Not Available" } }
      ]}
    }
  }, { headers: { Authorization: `Bearer ${TOKEN}` } });
}

app.get('/', (req,res)=> res.send('Ezi Live ✅ ' + (PHONE_ID||'')));

app.get('/send-daily', async (req,res)=>{
  try{
    if(!db) return res.send('DB not connected');
    const snap = await db.collection('workers').get();
    if(snap.empty){
      await sendAvailability('917206580660');
      return res.send('Sent to 917206580660 (test) - Add workers in Firestore');
    }
    for(const doc of snap.docs){
      await sendAvailability(doc.id);
    }
    res.send(`Sent to ${snap.size} workers ✅`);
  }catch(e){ res.send('Error: '+e.message); }
});

app.get('/webhook', (req,res)=>{
  if(req.query['hub.mode']=='subscribe' && req.query['hub.verify_token']==VERIFY_TOKEN){
    res.send(req.query['hub.challenge']);
  } else res.sendStatus(403);
});

app.post('/webhook', async (req,res)=>{
  try{
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if(msg){
      const from = msg.from;
      const btn = msg.interactive?.button_reply?.id || msg.button?.text || "";
      console.log(`FROM: ${from} BTN: ${btn}`);
      if(btn && db){
        const isAvail = !btn.includes('Not');
        await db.collection('workers').doc(from).set({ isAvailable: isAvail, lastUpdated: new Date(), phone: from }, {merge:true});
        console.log(`Updated ${from} -> ${isAvail}`);
      }
    }
    res.sendStatus(200);
  }catch(e){ console.log(e); res.sendStatus(200); }
});

// Roz subah 8 baje IST = 2:30 UTC
cron.schedule('30 2 * * *', async ()=>{
  console.log('Daily Cron Running...');
  try{
    const snap = await db.collection('workers').get();
    snap.forEach(d=> sendAvailability(d.id));
  }catch(e){ console.log(e.message); }
});

app.listen(10000, ()=> console.log('Live on 10000'));
