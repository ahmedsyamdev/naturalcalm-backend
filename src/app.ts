import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import healthRoutes from './routes/health.routes';

// Create Express app
const app: Application = express();

// CORS configuration
const corsOptions = {
  origin: env.NODE_ENV === 'production'
    ? ['https://yourdomain.com'] // Update with actual production domain
    : ['http://localhost:3000', 'http://localhost:8080'],
  credentials: true,
};

// Middlewares
app.use(cors(corsOptions));
app.use(helmet());
app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/v1/health', healthRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;
