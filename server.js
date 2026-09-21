const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

app.post('/send-otp', async (req, res) => {
    const { phone } = req.body;
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    console.log(`Request aaya: ${phone} OTP: ${otp}`);

    try {
        const r = await axios.post(
            `https://graph.facebook.com/v22.0/${process.env.PHONE_NUMBER_ID}/messages`,
            {
                messaging_product: "whatsapp",
                to: "91" + phone,
                type: "template",
                template: { name: "hello_world", language: { code: "en_US" } }
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
