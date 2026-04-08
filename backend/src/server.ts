import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import caseRoutes from './routes/cases.js';
import chatRoutes from './routes/chat.js';
import { createLogger, withErrorMeta } from './lib/logger.js';

const app = express();
const PORT = process.env.PORT || 3001;
const logger = createLogger('server');

// Middleware
const corsOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',') 
  : ['http://localhost:5173', 'http://localhost:8080'];

app.use(cors({
  origin: corsOrigins,
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/cases', caseRoutes);
app.use('/api/chat', chatRoutes);

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(
    'Unhandled backend error',
    withErrorMeta(err, { method: req.method, path: req.path, status: 500 })
  );
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  logger.info('Server started', {
    port: Number(PORT),
    corsOrigins,
    env: process.env.NODE_ENV ?? 'development',
    logLevel: process.env.LOG_LEVEL ?? 'auto',
  });
});
