import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';

import authRoutes from './routes/auth.js';
import meRoutes from './routes/me.js';
import tradesRoutes from './routes/trades.js';
import analyticsRoutes from './routes/analytics.js';
import importRoutes from './routes/importRoutes.js';
import accountsRoutes from './routes/accounts.js';
import journalRoutes from './routes/journal.js';
import rulesRoutes from './routes/rules.js';
import goalsRoutes from './routes/goals.js';
import dailyReviewRoutes from './routes/dailyReviews.js';
import strategiesRoutes from './routes/strategies.js';
import setupsRoutes from './routes/setups.js';
import preferencesRoutes from './routes/preferences.js';
import portfoliosRoutes from './routes/portfolios.js';
import investmentInstrumentsRoutes from './routes/investmentInstruments.js';
import portfolioTransactionsRoutes from './routes/portfolioTransactions.js';
import investmentPricesRoutes from './routes/investmentPrices.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Security headers
app.use(helmet());

// CORS — allow credentials so the refresh token cookie works
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

// Body parsing
app.use(express.json());
app.use(cookieParser());

// Logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Global rate limit
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT', message: 'Too many requests, please try again later.' } },
});
app.use('/api', globalLimiter);

// Stricter limit for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: { code: 'RATE_LIMIT', message: 'Too many auth attempts, please try again later.' } },
});

// Health check (no auth required)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/me', meRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/trades', tradesRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/rules', rulesRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/daily-reviews', dailyReviewRoutes);
app.use('/api/strategies', strategiesRoutes);
app.use('/api/setups', setupsRoutes);
app.use('/api/imports', importRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/portfolios', portfoliosRoutes);
app.use('/api/investment-instruments', investmentInstrumentsRoutes);
app.use('/api/portfolio-transactions', portfolioTransactionsRoutes);
app.use('/api/investment-prices', investmentPricesRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
});

// Global error handler — must be last
app.use(errorHandler);

export default app;
