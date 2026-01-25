const express = require('express');
const initDatabase = require('./utils/dbInit');
const routes = require('./routes');
const statsController = require('./controllers/statsController');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(express.json());

// Initialize database
initDatabase();

// Health check
app.get('/health', statsController.healthCheck);

// Mount routes
app.use('/state', routes);

app.listen(PORT, () => {
  console.log(`State Manager running on port ${PORT}`);
});