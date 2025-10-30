import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse } from '../utils/response';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const healthData = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      redis: 'not configured', // Will be updated when Redis is added
    };

    return successResponse(res, healthData, 'Health check successful', 200);
  })
);

export default router;
