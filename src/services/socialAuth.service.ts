import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';
import jwt, { JwtHeader, SigningKeyCallback } from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { env } from '../config/env';
import logger from '../utils/logger';

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS_URI = 'https://appleid.apple.com/auth/keys';

interface AppleIdTokenPayload {
  iss: string;
  aud: string;
  sub: string;
  exp: number;
  iat: number;
  email?: string;
  email_verified?: boolean | string;
  is_private_email?: boolean | string;
  nonce?: string;
}

export interface SocialAuthPayload {
  providerId: string;
  email?: string;
  name?: string;
  avatar?: string;
}

class SocialAuthService {
  private googleClient: OAuth2Client | null = null;
  private appleJwksClient: jwksClient.JwksClient | null = null;

  private getAppleJwksClient(): jwksClient.JwksClient {
    if (!this.appleJwksClient) {
      this.appleJwksClient = jwksClient({
        jwksUri: APPLE_JWKS_URI,
        cache: true,
        cacheMaxEntries: 5,
        cacheMaxAge: 24 * 60 * 60 * 1000,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        timeout: 10_000,
      });
    }
    return this.appleJwksClient;
  }

  private getApplePublicKey = (
    header: JwtHeader,
    callback: SigningKeyCallback
  ): void => {
    if (!header.kid) {
      callback(new Error('Apple token missing kid header'));
      return;
    }
    this.getAppleJwksClient().getSigningKey(header.kid, (err, key) => {
      if (err || !key) {
        callback(err || new Error('Apple signing key not found'));
        return;
      }
      callback(null, key.getPublicKey());
    });
  };

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
   * Verify Apple identity token (signature + claims) and extract user info.
   * Uses Apple's JWKS endpoint to verify the RS256 signature.
   */
  async verifyAppleToken(
    identityToken: string,
    user?: { name?: { firstName?: string; lastName?: string } }
  ): Promise<SocialAuthPayload> {
    if (!env.APPLE_CLIENT_ID) {
      throw new Error('Apple OAuth not configured');
    }

    const audienceList = env.APPLE_CLIENT_ID.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (audienceList.length === 0) {
      throw new Error('Apple OAuth not configured');
    }
    const audience: [string, ...string[]] = [
      audienceList[0],
      ...audienceList.slice(1),
    ];

    let payload: AppleIdTokenPayload;
    try {
      payload = await new Promise<AppleIdTokenPayload>((resolve, reject) => {
        jwt.verify(
          identityToken,
          this.getApplePublicKey,
          {
            algorithms: ['RS256'],
            issuer: APPLE_ISSUER,
            audience,
          },
          (err, decoded) => {
            if (err) {
              reject(err);
              return;
            }
            if (!decoded || typeof decoded === 'string') {
              reject(new Error('Invalid Apple token payload'));
              return;
            }
            resolve(decoded as AppleIdTokenPayload);
          }
        );
      });
    } catch (error: unknown) {
      logger.error('Apple token verification failed:', error);
      throw new Error('Invalid Apple token');
    }

    if (!payload.sub) {
      throw new Error('Invalid Apple token claims');
    }

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
      avatar: undefined,
    };
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
