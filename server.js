const express = require('express');
const app = express();
app.use(express.json());

const VERIFY_TOKEN = "ezi123";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = "1316526978211496";

app.get('/', (req, res) => res.send('Ezi Backend Live hai ✅'));

// Webhook Verify
app.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN) {
    return res.send(req.query['hub.challenge']);
  }
  res.sendStatus(403);
});

// Button click receive
app.post('/webhook', (req, res) => {
  console.log(JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

// Test route
app.get('/test-whatsapp', async (req, res) => {
  const number = req.query.number;
  if (!number) return res.send('Add ?number=91XXXXXXXXXX');
  const axios = require('axios');
  try {
    await axios.post(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
      messaging_product: "whatsapp",
      to: number,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: "EziService Test ✅\nAap available ho aaj?" },
        action: { buttons: [{ type: "reply", reply: { id: "Available", title: "Available" } }, { type: "reply", reply: { id: "Not Available", title: "Not Available" } }] }
      }
    }, { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } });
    res.send(`Sent to ${number} ✅`);
  } catch (e) {
    res.send(`Error: ${JSON.stringify(e.response?.data || e.message)}`);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('Live on ' + PORT));
