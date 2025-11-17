import { cacheSet, cacheExists } from '../config/redis';
import logger from '../utils/logger';

class TokenService {
  private readonly BLACKLIST_PREFIX = 'blacklist:token:';
  private readonly REFRESH_TOKEN_PREFIX = 'refresh:token:';

  /**
   * Add token to blacklist (for logout)
   * Token will be blacklisted until its natural expiration
   */
  async blacklistToken(
    token: string,
    expiresInSeconds: number
  ): Promise<boolean> {
    try {
      const key = `${this.BLACKLIST_PREFIX}${token}`;
      await cacheSet(key, true, expiresInSeconds);
      logger.info('Token blacklisted successfully');
      return true;
    } catch (error) {
      logger.error('Failed to blacklist token:', error);
      return false;
    }
  }

  /**
   * Check if token is blacklisted
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const key = `${this.BLACKLIST_PREFIX}${token}`;
      return await cacheExists(key);
    } catch (error) {
      logger.error('Failed to check token blacklist:', error);
      // On error, assume token is not blacklisted to avoid blocking legitimate requests
      return false;
    }
  }

  /**
   * Store refresh token in Redis (for rotation)
   */
  async storeRefreshToken(
    userId: string,
    token: string,
    expiresInSeconds: number
  ): Promise<boolean> {
    try {
      const key = `${this.REFRESH_TOKEN_PREFIX}${userId}`;
      await cacheSet(key, token, expiresInSeconds);
      return true;
    } catch (error) {
      logger.error('Failed to store refresh token:', error);
      return false;
    }
  }

  /**
   * Get stored refresh token for user
   */
  async getRefreshToken(userId: string): Promise<string | null> {
    try {
      const key = `${this.REFRESH_TOKEN_PREFIX}${userId}`;
      const client = await import('../config/redis').then((m) =>
        m.getRedisClient()
      );
      const token = await client.get(key);
      return token as string | null;
    } catch (error) {
      logger.error('Failed to get refresh token:', error);
      return null;
    }
  }

  /**
   * Invalidate refresh token (for logout or token rotation)
   */
  async invalidateRefreshToken(userId: string): Promise<boolean> {
    try {
      const key = `${this.REFRESH_TOKEN_PREFIX}${userId}`;
      const client = await import('../config/redis').then((m) =>
        m.getRedisClient()
      );
      await client.del(key);
      logger.info(`Refresh token invalidated for user ${userId}`);
      return true;
    } catch (error) {
      logger.error('Failed to invalidate refresh token:', error);
      return false;
    }
  }

  /**
   * Calculate seconds until token expiration
   */
  getSecondsUntilExpiration(expirationDate: Date): number {
    const now = new Date();
    const expiresAt = new Date(expirationDate);
    const secondsUntilExpiration = Math.floor(
      (expiresAt.getTime() - now.getTime()) / 1000
    );
    return Math.max(0, secondsUntilExpiration);
  }
}

export const tokenService = new TokenService();
