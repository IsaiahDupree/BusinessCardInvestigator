const express = require('express');
const path = require('path');
const businessController = require('./src/controllers/businessController');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

// Routes
app.get('/', (req, res) => {
  res.render('index');
});

app.post('/investigate', businessController.investigateBusiness);
app.get('/results/:id', businessController.getResults);

// Start server
app.listen(PORT, () => {
  console.log(`Business Card Investigator running on http://localhost:${PORT}`);
});
