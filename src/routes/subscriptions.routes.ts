import { Router } from 'express';
import {
  getPackages,
  subscribeToPackage,
  cancelSubscription,
  renewSubscription,
  upgradeSubscription,
} from '../controllers/subscriptions.controller';
import {
  validateSubscribe,
  validateRenew,
  validateUpgrade,
} from '../validators/subscriptions.validator';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

/**
 * Public routes
 */

// Get all subscription packages
router.get('/packages', getPackages);

/**
 * Protected routes (require authentication)
 */

// Subscribe to a package
router.post('/subscribe', protect, validateSubscribe, subscribeToPackage);

// Cancel subscription
router.post('/cancel', protect, cancelSubscription);

// Renew subscription
router.post('/renew', protect, validateRenew, renewSubscription);

// Upgrade/Downgrade subscription
router.put('/upgrade', protect, validateUpgrade, upgradeSubscription);

export default router;
