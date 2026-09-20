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

app.get('/send-daily', async (req,res)=>{
  try{
    const snap = await db.collection("workers").get();
    console.log("Total workers found:", snap.size);
    let count=0;
    for(let doc of snap.docs){
      let w = doc.data();
      // Home Repair category check
      if(w.skill === "Home Repair" || w.category === "Home Repair" || w.serviceType === "Home Repair"){
        let phone = (w.phone||"").toString().replace(/\D/g,'');
        if(phone.length===10) phone="91"+phone;
        console.log("Sending to:", phone, w.name);
        await sendBusyAvailable(phone, w.name||"Worker", doc.id);
        count++;
      }
    }
    res.send(`Daily Sent ${count} messages, DB:OK - Total workers in DB: ${snap.size}`);
  }catch(e){
    console.log(e);
    res.send("Error: "+e.message);
  }
});

app.listen(process.env.PORT||10000,()=>console.log('Live'));
