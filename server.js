const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

let bookings = [];

app.get('/', (req,res) => res.send('Ezi Services Backend is Live! Panipat'));

app.post('/api/book', (req,res) => {
  bookings.push(req.body);
  console.log('New Booking:', req.body);
  res.json({success: true});
});

app.get('/api/bookings', (req,res) => res.json(bookings));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('Server running'));
