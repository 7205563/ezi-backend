const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();
app.use(bodyParser.json());

let db=null; let fbStatus="Not init"; let projectId="unknown";
try{
  let keyStr = process.env.FIREBASE_KEY || "";
  let t = keyStr.trim();
  if(!t.startsWith("{")) t = Buffer.from(t, 'base64').toString('utf-8');
  const parsed = JSON.parse(t.trim());
  projectId = parsed.project_id;
  const admin = require("firebase-admin");
  if(!admin.apps.length) admin.initializeApp({credential: admin.credential.cert(parsed)});
  db = admin.firestore();
  fbStatus="OK"; 
  console.log("Firebase OK Project:", projectId);
}catch(e){ fbStatus=e.message; console.log("Firebase Fail:", e.message); }

const PHONE_ID = process.env.PHONE_NUMBER_ID || "1316526978211496";
const TOKEN = process.env.WHATSAPP_TOKEN;

async function sendBusyAvailable(phone,name,workerId){
  return axios.post(`https://graph.facebook.com/v22.0/${PHONE_ID}/messages`,{
    messaging_product:"whatsapp",
    to: phone,
    type:"interactive",
    interactive:{
      type:"button",
      body:{text:`Hi ${name}! Ezi Services\nAre you Busy or Available today?`},
      action:{buttons:[
        {type:"reply", reply:{id:`available_${workerId}`, title:"✅ Available"}},
        {type:"reply", reply:{id:`busy_${workerId}`, title:"❌ Busy"}}
      ]}
    }
  },{headers:{Authorization:`Bearer ${TOKEN}`}});
}

app.get('/', (req,res)=> res.send(`Running OK - Project: ${projectId} - FB: ${fbStatus}`));

app.get('/add-my-worker', async (req,res)=>{
  try{
    await db.collection("workers").doc("EeIINIAVJQTyUfbqOsMm").set({
      name: "Test Worker",
      phone: "917206580660",
      skill: "Home Repair",
      category: "Home Repair",
      status: "active"
    });
    const snap = await db.collection("workers").get();
    res.send(`Worker Added! Project: ${projectId}, Total now: ${snap.size}`);
  }catch(e){ res.send("Add Error: "+e.message); }
});

app.get('/send-daily', async (req,res)=>{
  try{
    const snap = await db.collection("workers").get();
    let count=0;
    for(let doc of snap.docs){
      let w=doc.data();
      let phone=(w.phone||"").toString().replace(/\D/g,'');
      if(phone.length===10) phone="91"+phone;
      if(phone.length>=12){
        await sendBusyAvailable(phone, w.name||"Worker", doc.id);
        count++;
      }
    }
    res.send(`Daily Sent ${count} messages, DB:${fbStatus} - Total workers in DB: ${snap.size} - Project: ${projectId}`);
  }catch(e){ res.send("Error: "+e.message); }
});

app.listen(process.env.PORT||10000, ()=>console.log("Server running"));
