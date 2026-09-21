const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// OTP ko yaad rakhne ke liye (Memory Store)
const otpStore = {};

// 1. Check karne ke liye - Render pe Live hai ya nahi
app.get('/', (req, res) => {
  res.status(200).send('Ezi Backend Live Hai! - WhatsApp OTP Ready');
});

// 2. WhatsApp OTP Bhejne wala API
app.post('/send-otp', async (req, res) => {
  const { phone } = req.body;

  if (!phone || phone.length!== 10) {
    return res.status(400).json({ success: false, message: 'Valid 10 digit phone chahiye' });
  }

  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  otpStore[phone] = otp; // OTP save kar liya verify ke liye

  console.log(`[EZI] Phone: ${phone} | OTP: ${otp}`);

  // Env check
  if (!process.env.PHONE_NUMBER_ID ||!process.env.WHATSAPP_TOKEN) {
    console.log('ENV missing, par testing ke liye OTP bhej raha hu');
    return res.json({ success: true, otp: otp, message: 'Env missing, but OTP generated for testing' });
  }

  try {
    // Pehle hello_world se test karenge, jab aapka ezi_otp template approve ho jayega tab uska naam daal dena
    const templateName = "hello_world"; // Jab approve ho jaye to "ezi_otp" kar dena

    let whatsappPayload;
    if (templateName === "ezi_otp") {
      whatsappPayload = {
        messaging_product: "whatsapp",
        to: "91" + phone,
        type: "template",
        template: {
          name: "ezi_otp",
          language: { code: "en_US" },
          components: [{ type: "body", parameters: [{ type: "text", text: otp }] }]
        }
      };
    } else {
      whatsappPayload = {
        messaging_product: "whatsapp",
        to: "91" + phone,
        type: "template",
        template: { name: "hello_world", language: { code: "en_US" } }
      };
    }

    const response = await axios.post(
      `https://graph.facebook.com/v22.0/${process.env.PHONE_NUMBER_ID}/messages`,
      whatsappPayload,
      { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` } }
    );

    console.log('WHATSAPP SUCCESS:', response.data);
    // Testing ke liye OTP bhi bhej raha hu, live me is line se otp hata dena
    res.json({ success: true, otp: otp });

  } catch (error) {
    console.error('WHATSAPP FAILED:', error.response?.data || error.message);
    // WhatsApp fail bhi ho jaye to bhi OTP de denge taaki app kaam kare
    res.json({ success: true, otp: otp, warning: 'WhatsApp API failed, using test OTP' });
  }
});

// 3. OTP Verify karne wala API
app.post('/verify-otp', (req, res) => {
  const { phone, otp } = req.body;
  if (otpStore[phone] && otpStore[phone] === otp) {
    delete otpStore[phone];
    return res.json({ success: true, message: 'OTP Verified' });
  }
  return res.json({ success: false, message: 'Galat OTP' });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Ezi Backend Running on Port ${PORT}`);
});
