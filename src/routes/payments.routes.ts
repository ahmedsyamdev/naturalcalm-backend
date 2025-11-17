import { Router } from 'express';
import {
  createPaymentIntent,
  confirmPayment,
  validateCoupon,
  getPaymentMethods,
  handleStripeWebhook,
  refundPayment,
  getPaymentAnalytics,
  createTestPayment,
} from '../controllers/payments.controller';
import { protect, authorize } from '../middlewares/auth.middleware';

const router = Router();

/**
 * Public routes
 */

// Stripe webhook (no auth middleware, Stripe signature verification in controller)
router.post('/webhook', handleStripeWebhook);

/**
 * Protected routes (require authentication)
 */

// Create payment intent
router.post('/create-intent', protect, createPaymentIntent);

// Confirm payment
router.post('/confirm', protect, confirmPayment);

// Validate coupon
router.post('/validate-coupon', protect, validateCoupon);

// Test payment (development only)
router.post('/test-payment', protect, createTestPayment);

// Get payment methods
router.get('/methods', protect, getPaymentMethods);

/**
 * Admin routes (require admin authorization)
 */

// Refund payment
router.post('/:paymentId/refund', protect, authorize('admin'), refundPayment);

// Get payment analytics
router.get('/analytics', protect, authorize('admin'), getPaymentAnalytics);

export default router;
