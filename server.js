const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');
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
const PHONE_ID = process.env.PHONE_NUMBER_ID1316526978211496;

app.get('/', (req,res)=> res.send('Ezi Live ✅ ' + (PHONE_ID||'')));

app.get('/webhook', (req,res)=>{
  if(req.query['hub.mode']==='subscribe' && req.query['hub.verify_token']===VERIFY_TOKEN){
    return res.send(req.query['hub.challenge']);
  }
  res.sendStatus(403);
});

app.post('/webhook', async (req,res)=>{
  console.log("WEBHOOK HIT:", JSON.stringify(req.body).slice(0,1000));
  try{
    const val = req.body.entry?.[0]?.changes?.[0]?.value;
    const msg = val?.messages?.[0];
    const from = msg?.from;
    const btn = msg?.interactive?.button_reply?.id || msg?.button?.text || msg?.text?.body;
    console.log("FROM:", from, "BTN:", btn);

    if(from && db){
      const isAv = btn?.toLowerCase() === 'available';
      await db.collection('workers').doc(from).set({
        isAvailable: isAv,
        lastResponse: btn,
        lastSeen: admin.firestore.FieldValue.serverTimestamp(),
        phone: from
      }, {merge:true});
      console.log(`Updated ${from} -> ${isAv}`);
    }
  }catch(e){ console.error(e.message); }
  res.sendStatus(200);
});

app.get('/test-whatsapp', async (req,res)=>{
  try{
    const to = req.query.number;
    if(!to) return res.send("Add?number=91720...");
    const r = await axios.post(`https://graph.facebook.com/v20.0/${PHONE_ID}/messages`,{
      messaging_product:"whatsapp",
      to: to,
      type:"interactive",
      interactive:{
        type:"button",
        body:{text:"Hi, EziService pe aaj kaam ke liye available ho?"},
        action:{buttons:[
          {type:"reply", reply:{id:"Available", title:"Available"}},
          {type:"reply", reply:{id:"Not Available", title:"Not Available"}}
        ]}
      }
    },{headers:{Authorization:`Bearer ${TOKEN}`}});
    res.send(`Sent ✅ ${r.data.messages?.[0]?.id}`);
  }catch(e){
    console.error(e.response?.data);
    res.send(`Error: ${JSON.stringify(e.response?.data)}`);
  }
});

app.listen(process.env.PORT||10000, ()=> console.log("Live on 10000"));
