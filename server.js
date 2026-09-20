const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();
app.use(bodyParser.json());

let db=null; let fbError="Not init";
try{
  let keyStr=process.env.FIREBASE_KEY||"";
  let t=keyStr.trim();
  if(!t.startsWith("{")) t=Buffer.from(t,'base64').toString('utf-8');
  const parsed=JSON.parse(t.trim());
  const admin=require("firebase-admin");
  admin.initializeApp({credential:admin.credential.cert(parsed)});
  db=admin.firestore(); fbError="OK";
  console.log("Firebase OK ✅");
}catch(e){ fbError=e.message; console.log("Firebase Fail:",e.message); }

const PHONE_ID=process.env.WHATSAPP_PHONE_ID||"1316526978211496";
const TOKEN=process.env.WHATSAPP_TOKEN;

async function sendBusyAvailable(phone,name,workerId){
  try{
    await axios.post(`https://graph.facebook.com/v22.0/${PHONE_ID}/messages`,{
      messaging_product:"whatsapp",
      to:`91${phone}`,
      type:"interactive",
      interactive:{
        type:"button",
        body:{text:`Hi ${name}! Ezi Services\nAap abhi Available ho ya Busy?`},
        action:{buttons:[
          {type:"reply",reply:{id:`AVAILABLE_${workerId}`,title:"✅ Available"}},
          {type:"reply",reply:{id:`BUSY_${workerId}`,title:"❌ Busy"}}
        ]}
      }
    },{headers:{Authorization:`Bearer ${TOKEN}`}});
    console.log("Sent to",phone);
  }catch(e){ console.log("WA Err",e.response?.data||e.message); }
}

app.get('/',(req,res)=> res.send(`Ezi Backend Live | DB:${fbError} | LEN:${(process.env.FIREBASE_KEY||'').length} | TOKEN:${TOKEN?"YES":"NO"}`));

app.get('/send-daily',async(req,res)=>{
  if(!db) return res.send("DB not ready: "+fbError);
  if(!TOKEN) return res.send("TOKEN missing - Render me WHATSAPP_TOKEN add kar");
  const snap=await db.collection("workers").get();
  let c=0;
  for(const doc of snap.docs){
    const w=doc.data();
    if(w.serviceType==="Home Repair" || !w.serviceType){
      await sendBusyAvailable(w.phone||w.mobile||w.number, w.name||"Worker", w.id||doc.id);
      c++;
    }
  }
  res.send(`Daily Sent ${c} messages, DB:${fbError}`);
});

app.listen(process.env.PORT||10000,()=>console.log('Live'));
