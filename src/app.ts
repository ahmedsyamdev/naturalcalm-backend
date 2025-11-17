import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import { initializeLocalStorage } from './utils/localStorage';
import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import uploadRoutes from './routes/upload.routes';
import tracksRoutes from './routes/tracks.routes';
import programsRoutes from './routes/programs.routes';
import categoriesRoutes from './routes/categories.routes';
import userProgramsRoutes from './routes/userPrograms.routes';
import favoritesRoutes from './routes/favorites.routes';
import listeningSessionsRoutes from './routes/listeningSessions.routes';
import searchRoutes from './routes/search.routes';
import subscriptionsRoutes from './routes/subscriptions.routes';
import paymentsRoutes from './routes/payments.routes';
import adminRoutes from './routes/admin.routes';
import notificationsRoutes from './routes/notifications.routes';
import analyticsRoutes from './routes/analytics.routes';

// Create Express app
const app: Application = express();

// Parse CORS origins from environment variable or use defaults
const getCorsOrigins = (): string[] => {
  // If CORS_ORIGINS is set, parse it (comma-separated)
  if (env.CORS_ORIGINS) {
    return env.CORS_ORIGINS.split(',').map(origin => origin.trim());
  }
  // If FRONTEND_URL is set, use it
  if (env.FRONTEND_URL) {
    return [env.FRONTEND_URL];
  }
  // Default fallback for development
  return env.NODE_ENV === 'production'
    ? [] // In production, CORS_ORIGINS or FRONTEND_URL must be set
    : ['http://localhost:3000', 'http://localhost:8080'];
};

// CORS configuration
const corsOptions = {
  origin: getCorsOrigins(),
  credentials: true,
};

// Middlewares
app.use(cors(corsOptions));
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// Stripe webhook needs raw body for signature verification
app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json' }));

// Regular JSON parsing for all other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public/uploads directory
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

// Initialize local storage directories on startup
initializeLocalStorage().catch(err => {
  console.error('Failed to initialize local storage:', err);
});

// API Routes
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/categories', categoriesRoutes);
app.use('/api/v1/tracks', tracksRoutes);
app.use('/api/v1/programs', programsRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/users', userProgramsRoutes);
app.use('/api/v1/users/favorites', favoritesRoutes);
app.use('/api/v1/users/listening-sessions', listeningSessionsRoutes);
app.use('/api/v1/subscriptions', subscriptionsRoutes);
app.use('/api/v1/payments', paymentsRoutes);
app.use('/api/v1/admin/payments', paymentsRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/analytics', analyticsRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;
