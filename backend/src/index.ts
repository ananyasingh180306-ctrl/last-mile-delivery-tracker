import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';

// Load env variables
dotenv.config();

import authRoutes from './routes/auth';
import zoneRoutes from './routes/zones';
import rateRoutes from './routes/rates';
import orderRoutes from './routes/orders';
import agentRoutes from './routes/agents';
import { swaggerSpec } from './config/swagger';
import { initSocket } from './services/socket';

const app = express();
const server = http.createServer(app);

// Initialize WebSockets
initSocket(server);

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/rates', rateRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/agents', agentRoutes);

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Root Endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Last-Mile Delivery Tracker API',
    docs: '/api-docs',
    version: '1.0.0'
  });
});

// Error handling fallback
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Swagger Docs available at http://localhost:${PORT}/api-docs`);
});

export default server;
