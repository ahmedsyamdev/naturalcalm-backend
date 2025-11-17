import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';
import { env } from '../config/env';
import logger from '../utils/logger';

export interface SocialAuthPayload {
  providerId: string;
  email?: string;
  name?: string;
  avatar?: string;
}

class SocialAuthService {
  private googleClient: OAuth2Client | null = null;

  /**
   * Initialize Google OAuth client lazily
   */
  private getGoogleClient(): OAuth2Client {
    if (!this.googleClient && env.GOOGLE_CLIENT_ID) {
      this.googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);
    }
    if (!this.googleClient) {
      throw new Error('Google OAuth client not configured');
    }
    return this.googleClient;
  }

  /**
   * Verify Google ID token and extract user info
   */
  async verifyGoogleToken(idToken: string): Promise<SocialAuthPayload> {
    try {
      const client = this.getGoogleClient();
      const ticket = await client.verifyIdToken({
        idToken,
        audience: env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.sub) {
        throw new Error('Invalid Google token payload');
      }

      return {
        providerId: payload.sub,
        email: payload.email,
        name: payload.name,
        avatar: payload.picture,
      };
    } catch (error: unknown) {
      logger.error('Google token verification failed:', error);
      throw new Error('Invalid Google token');
    }
  }

  /**
   * Verify Facebook access token and extract user info
   */
  async verifyFacebookToken(accessToken: string): Promise<SocialAuthPayload> {
    try {
      if (!env.FACEBOOK_APP_ID || !env.FACEBOOK_APP_SECRET) {
        throw new Error('Facebook OAuth not configured');
      }

      // Verify token with Facebook
      const debugResponse = await axios.get(
        `https://graph.facebook.com/debug_token`,
        {
          params: {
            input_token: accessToken,
            access_token: `${env.FACEBOOK_APP_ID}|${env.FACEBOOK_APP_SECRET}`,
          },
        }
      );

      const debugData = debugResponse.data.data;
      if (!debugData.is_valid || debugData.app_id !== env.FACEBOOK_APP_ID) {
        throw new Error('Invalid Facebook token');
      }

      // Get user info
      const userResponse = await axios.get(`https://graph.facebook.com/me`, {
        params: {
          fields: 'id,name,email,picture',
          access_token: accessToken,
        },
      });

      const userData = userResponse.data;

      return {
        providerId: userData.id,
        email: userData.email,
        name: userData.name,
        avatar: userData.picture?.data?.url,
      };
    } catch (error: unknown) {
      logger.error('Facebook token verification failed:', error);
      throw new Error('Invalid Facebook token');
    }
  }

  /**
   * Verify Apple identity token and extract user info
   * Note: Apple token verification requires more complex setup with JWT verification
   * This is a simplified version - in production, you should verify the JWT signature
   */
  async verifyAppleToken(
    identityToken: string,
    user?: { name?: { firstName?: string; lastName?: string } }
  ): Promise<SocialAuthPayload> {
    try {
      if (!env.APPLE_CLIENT_ID) {
        throw new Error('Apple OAuth not configured');
      }

      // Decode the identity token (without verification for now)
      // In production, you should verify the JWT signature using Apple's public keys
      const parts = identityToken.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid Apple token format');
      }

      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64').toString('utf-8')
      );

      // Verify basic claims
      if (
        !payload.sub ||
        payload.aud !== env.APPLE_CLIENT_ID ||
        payload.iss !== 'https://appleid.apple.com'
      ) {
        throw new Error('Invalid Apple token claims');
      }

      // Check token expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        throw new Error('Apple token expired');
      }

      // Build name from user object if provided (only sent on first login)
      let name: string | undefined;
      if (user?.name) {
        const firstName = user.name.firstName || '';
        const lastName = user.name.lastName || '';
        name = `${firstName} ${lastName}`.trim() || undefined;
      }

      return {
        providerId: payload.sub,
        email: payload.email,
        name,
        avatar: undefined, // Apple doesn't provide avatar
      };
    } catch (error: unknown) {
      logger.error('Apple token verification failed:', error);
      throw new Error('Invalid Apple token');
    }
  }

  /**
   * Verify social auth token based on provider
   */
  async verifySocialToken(
    provider: 'google' | 'facebook' | 'apple',
    token: string,
    appleUser?: { name?: { firstName?: string; lastName?: string } }
  ): Promise<SocialAuthPayload> {
    switch (provider) {
      case 'google':
        return this.verifyGoogleToken(token);
      case 'facebook':
        return this.verifyFacebookToken(token);
      case 'apple':
        return this.verifyAppleToken(token, appleUser);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }
}

export const socialAuthService = new SocialAuthService();
