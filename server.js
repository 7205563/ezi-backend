const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

// Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const VERIFY_TOKEN = "ezi123";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

app.get('/', (req,res)=> res.send('Ezi Backend Live'));

// Webhook Verify
app.get('/webhook', (req,res)=>{
  if(req.query['hub.verify_token'] === VERIFY_TOKEN){
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(403);
  }
});

// Webhook Receive - BUTTON CLICK
app.post('/webhook', async (req,res)=>{
  console.log("WEBHOOK AAYA:", JSON.stringify(req.body).substring(0,500));
  try{
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;
    if(messages && messages[0]){
      const msg = messages[0];
      const from = msg.from; // worker phone
      let reply = "";
      if(msg.button && msg.button.text) reply = msg.button.text;
      if(msg.interactive && msg.interactive.button_reply) reply = msg.interactive.button_reply.title;

      console.log(`From: ${from} Button: ${reply}`);

      // Find worker and update
      const workers = await db.collection('workers').where('phone','==',from).get();
      if(!workers.empty){
        let availability = reply.toLowerCase().includes('avail')? 'Available' : 'Busy';
        await workers.docs[0].ref.update({
          availability: availability,
          isAvailable: availability === 'Available',
          lastUpdated: new Date()
        });
        console.log(`Updated ${from} to ${availability}`);
      }
    }
  }catch(e){ console.log("Error:", e.message); }
  res.sendStatus(200);
});

// Check Availability - Sends WhatsApp to all workers
app.get('/check-availability', async (req,res)=>{
  try{
    const workersSnap = await db.collection('workers').get();
    for(const doc of workersSnap.docs){
      const w = doc.data();
      if(!w.phone) continue;
      await axios.post(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,{
        messaging_product:"whatsapp",
        to: w.phone,
        type:"interactive",
        interactive:{
          type:"button",
          body:{ text:`Hi ${w.name || 'Test Worker'}! Aaj available ho?` },
          action:{ buttons:[
            {type:"reply", reply:{id:"avail_yes", title:"✅ Available"}},
            {type:"reply", reply:{id:"avail_no", title:"❌ Busy"}}
          ]}
        }
      },{
        headers:{ Authorization:`Bearer ${WHATSAPP_TOKEN}`, 'Content-Type':'application/json' }
      });
    }
    res.send("Messages sent to all workers");
  }catch(e){
    console.log(e.response?.data || e.message);
    res.status(500).send(e.message);
  }
});

app.listen(10000, ()=> console.log("Server on 10000"));
