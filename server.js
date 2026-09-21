const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

// Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const VERIFY_TOKEN = "ezi123";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

app.get('/', (req,res)=> res.send('Ezi Backend Live'));

// OTP Bhejne ka API
app.post('/send-otp', async (req,res)=>{
  const {phone, otp} = req.body;
  try {
    await axios.post(`https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`,{
      messaging_product:"whatsapp",
      to:"91"+phone,
      type:"template",
      template:{
  name:"ezi_otp", 
  language:{code:"en_US"}, 
  components:[{type:"body", parameters:[{type:"text", text: otp }]}]
}
    },{headers:{Authorization:`Bearer ${WHATSAPP_TOKEN}`}});
    res.json({ok:true});
  } catch(e){ res.status(500).json({error:e.response?.data||e.message}); }
});

// Webhook Verify - Yahi se Meta Verify karega
app.get('/webhook', (req,res)=>{
  if(req.query['hub.verify_token']===VERIFY_TOKEN){
    res.send(req.query['hub.challenge']);
  } else res.sendStatus(403);
});

// Webhook Receive - User jab Available/Busy/Yes dabayega
app.post('/webhook', async (req,res)=>{
  try{
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if(!msg) return res.sendStatus(200);
    const from = msg.from.replace("91","");
    const reply = (msg.button?.text || msg.text?.body || "").toUpperCase();
    console.log("Reply from", from, reply);

    const snap = await db.collection("workers").doc(from).get();
    const fcmToken = snap.exists? snap.data().fcmToken : null;

    if(reply.includes("AVAILABLE") || reply.includes("BUSY")){
      await db.collection("workers").doc(from).set({isAvailable: reply.includes("AVAILABLE"), lastStatusUpdate: Date.now()}, {merge:true});
      if(fcmToken){
        await admin.messaging().send({token:fcmToken, data:{action:reply}});
      }
    }
    if(reply.includes("YES")){
      const reqSnap = await db.collection("requirements").where("phone","==",from).get();
      reqSnap.forEach(d=>d.ref.delete());
    }
    res.sendStatus(200);
  } catch(e){ console.log(e); res.sendStatus(200); }
});

app.listen(10000, ()=> console.log("Ezi Backend Running"));
