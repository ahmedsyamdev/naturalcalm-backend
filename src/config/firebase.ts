import admin from 'firebase-admin';
import { env } from './env';
import logger from '../utils/logger';

let firebaseApp: admin.app.App | null = null;

/**
 * Initialize Firebase Admin SDK
 * This is optional - the app will work without Firebase
 */
export const initializeFirebase = (): admin.app.App | null => {
  try {
    // Check if Firebase credentials are provided
    if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_PRIVATE_KEY || !env.FIREBASE_CLIENT_EMAIL) {
      logger.info('Firebase credentials not configured. Push notifications will be disabled.');
      return null;
    }

    // Initialize Firebase Admin SDK
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FIREBASE_PROJECT_ID,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
      }),
    });

    logger.info('✅ Firebase Admin SDK initialized successfully');
    return firebaseApp;
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin SDK:', error);
    logger.warn('⚠️  Push notifications will be disabled');
    return null;
  }
};

/**
 * Get Firebase Admin instance
 */
export const getFirebaseAdmin = (): admin.app.App | null => {
  return firebaseApp;
};

/**
 * Get Firebase Messaging instance
 */
export const getFirebaseMessaging = (): admin.messaging.Messaging | null => {
  if (!firebaseApp) {
    return null;
  }
  return firebaseApp.messaging();
};

/**
 * Send push notification using Firebase Cloud Messaging
 */
export const sendFCMNotification = async (
  token: string,
  notification: {
    title: string;
    body: string;
    imageUrl?: string;
  },
  data?: Record<string, string>,
  dryRun: boolean = false
): Promise<boolean> => {
  const messaging = getFirebaseMessaging();

  if (!messaging) {
    logger.warn('Firebase Messaging not initialized. Cannot send push notification.');
    return false;
  }

  try {
    const message: admin.messaging.Message = {
      token,
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.imageUrl && { imageUrl: notification.imageUrl }),
      },
      ...(data && { data }),
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          priority: 'high',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const response = await messaging.send(message, dryRun);

    if (dryRun) {
      logger.debug('FCM dry run successful for token:', token.substring(0, 20) + '...');
    } else {
      logger.info('FCM notification sent successfully:', response);
    }

    return true;
  } catch (error) {
    logger.error('Failed to send FCM notification:', error);

    // Handle invalid token errors
    if (error instanceof Error) {
      if (error.message.includes('invalid-registration-token') ||
          error.message.includes('registration-token-not-registered')) {
        logger.warn(`FCM token is invalid or expired: ${token.substring(0, 20)}...`);
      }
    }

    return false;
  }
};

/**
 * Send notifications to multiple tokens
 */
export const sendMulticastFCMNotification = async (
  tokens: string[],
  notification: {
    title: string;
    body: string;
    imageUrl?: string;
  },
  data?: Record<string, string>
): Promise<{ successCount: number; failureCount: number }> => {
  const messaging = getFirebaseMessaging();

  if (!messaging) {
    logger.warn('Firebase Messaging not initialized. Cannot send push notifications.');
    return { successCount: 0, failureCount: tokens.length };
  }

  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  try {
    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.imageUrl && { imageUrl: notification.imageUrl }),
      },
      ...(data && { data }),
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          priority: 'high',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const response = await messaging.sendEachForMulticast(message);

    logger.info(`FCM multicast sent: ${response.successCount} successful, ${response.failureCount} failed`);

    // Log failed tokens for cleanup
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          logger.warn(`Failed to send to token ${tokens[idx].substring(0, 20)}...: ${resp.error?.message}`);
        }
      });
    }

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    logger.error('Failed to send multicast FCM notification:', error);
    return { successCount: 0, failureCount: tokens.length };
  }
};
