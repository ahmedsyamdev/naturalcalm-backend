import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse } from '../utils/response';
import { getRedisClient } from '../config/redis';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    let redisStatus = 'disconnected';
    try {
      const client = getRedisClient();
      redisStatus = client.isReady ? 'connected' : 'disconnected';
    } catch {
      redisStatus = 'not configured';
    }

    const healthData = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      mongodb:
        mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      redis: redisStatus,
    };

    return successResponse(res, healthData, 'Health check successful', 200);
  })
);

export default router;
