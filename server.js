const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Ezi Services Backend is Live! All India 🇮🇳');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', region: 'ALL_INDIA', message: 'Ezi is live all over India' });
});

app.get('/api/providers/nearby', (req, res) => {
  const { lat, lng } = req.query;
  res.json({ 
    message: 'All India providers search active',
    your_location: { lat, lng },
    providers: [] 
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Ezi All India Live on ${PORT}`));
