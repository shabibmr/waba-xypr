import express from 'express';
import initDatabase from './utils/dbInit';
import routes from './routes/index';
import statsController from './controllers/statsController';
// @ts-ignore
import { tenantResolver } from '../../../shared/middleware/tenantResolver';

const app = express();
const PORT = process.env.PORT || 3005;

app.use(express.json());

// Initialize database
initDatabase();

// Health check (no auth required)
app.get('/health', statsController.healthCheck);

// Apply tenant resolver middleware to all state routes
app.use('/state', tenantResolver);

// Mount routes
app.use('/state', routes);

app.listen(PORT, () => {
  console.log(`State Manager running on port ${PORT}`);
});