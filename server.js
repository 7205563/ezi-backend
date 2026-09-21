const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();
const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/send-whatsapp-otp', async (req, res) => {
  const { phone, otp } = req.body;
  console.log(`Request aaya: ${phone} OTP: ${otp}`);

  try {
    const r = await axios.post(
      `https://graph.facebook.com/v22.0/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: "91" + phone,
        type: "template",
        template: {
          name: "ezi_otp", // hello_world nahi, ye wala
          language: { code: "en_US" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: otp } // {{1}} me OTP jayega
              ]
            }
          ]
        }
      },
      { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` } }
    );
    console.log("WHATSAPP SENT SUCCESS:", r.data);
    res.json({ success: true });
  } catch (e) {
    console.log("WHATSAPP ERROR:", e.response?.data || e.message);
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

app.listen(10000, () => console.log("Ezi Backend Running"));
