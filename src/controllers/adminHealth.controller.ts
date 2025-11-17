import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { getRedisClient } from '../config/redis';
import { isR2Configured, getR2Client, getR2BucketName } from '../config/r2';
import { HeadBucketCommand } from '@aws-sdk/client-s3';
import stripe from '../config/stripe';
import logger from '../utils/logger';

interface HealthStatus {
  service: string;
  status: 'healthy' | 'unhealthy' | 'not_configured';
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * System health check
 * GET /api/v1/admin/health
 */
export const getSystemHealth = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const healthChecks: HealthStatus[] = [];

    // 1. Check MongoDB connection
    try {
      const mongoStatus = mongoose.connection.readyState;
      const mongoHealth: HealthStatus = {
        service: 'MongoDB',
        status:
          mongoStatus === 1
            ? 'healthy'
            : mongoStatus === 2
            ? 'healthy'
            : 'unhealthy',
        details: {
          readyState: mongoStatus,
          host: mongoose.connection.host,
          name: mongoose.connection.name,
        },
      };

      if (mongoStatus === 1 || mongoStatus === 2) {
        mongoHealth.message = 'Connected and operational';
      } else {
        mongoHealth.message = 'Not connected or connecting';
      }

      healthChecks.push(mongoHealth);
    } catch (error) {
      healthChecks.push({
        service: 'MongoDB',
        status: 'unhealthy',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to check MongoDB status',
      });
    }

    // 2. Check Redis connection
    try {
      const redisClient = getRedisClient();
      const isRedisReady = redisClient.isReady;

      if (isRedisReady) {
        // Test Redis with a ping
        const pingResponse = await redisClient.ping();

        healthChecks.push({
          service: 'Redis',
          status: pingResponse === 'PONG' ? 'healthy' : 'unhealthy',
          message:
            pingResponse === 'PONG'
              ? 'Connected and responding'
              : 'Connected but not responding correctly',
        });
      } else {
        healthChecks.push({
          service: 'Redis',
          status: 'unhealthy',
          message: 'Redis client is not ready',
        });
      }
    } catch (error) {
      healthChecks.push({
        service: 'Redis',
        status: 'unhealthy',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to check Redis status',
      });
    }

    // 3. Check R2 (Cloudflare Storage) connectivity
    try {
      if (isR2Configured()) {
        const r2Client = getR2Client();
        const bucketName = getR2BucketName();

        // Test R2 with a head bucket command
        await r2Client.send(new HeadBucketCommand({ Bucket: bucketName }));

        healthChecks.push({
          service: 'Cloudflare R2',
          status: 'healthy',
          message: 'Connected and bucket accessible',
          details: {
            bucket: bucketName,
          },
        });
      } else {
        healthChecks.push({
          service: 'Cloudflare R2',
          status: 'not_configured',
          message: 'R2 is not configured',
        });
      }
    } catch (error) {
      healthChecks.push({
        service: 'Cloudflare R2',
        status: 'unhealthy',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to check R2 connectivity',
      });
    }

    // 4. Check Stripe API status
    try {
      // Test Stripe by retrieving account info
      const account = await stripe.accounts.retrieve();

      healthChecks.push({
        service: 'Stripe',
        status: 'healthy',
        message: 'Connected and operational',
        details: {
          accountId: account.id,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
        },
      });
    } catch (error) {
      healthChecks.push({
        service: 'Stripe',
        status: 'unhealthy',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to check Stripe status',
      });
    }

    // Determine overall system health
    const hasUnhealthy = healthChecks.some((hc) => hc.status === 'unhealthy');
    const overallStatus = hasUnhealthy ? 'degraded' : 'healthy';

    // Calculate uptime
    const uptime = process.uptime();
    const uptimeFormatted = formatUptime(uptime);

    res.status(hasUnhealthy ? 503 : 200).json({
      success: !hasUnhealthy,
      data: {
        status: overallStatus,
        timestamp: new Date(),
        uptime: uptimeFormatted,
        uptimeSeconds: uptime,
        services: healthChecks,
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
      },
    });

    logger.info(`Health check performed by admin ${req.user?.id}`);
  } catch (error) {
    logger.error('System health check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform health check',
    });
  }
};

/**
 * Format uptime in human-readable format
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}
