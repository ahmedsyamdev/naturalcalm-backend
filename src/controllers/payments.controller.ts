import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import stripe from '../config/stripe';
import { Package } from '../models/Package.model';
import { Payment, IPayment } from '../models/Payment.model';
import { Coupon } from '../models/Coupon.model';
import { Subscription } from '../models/Subscription.model';
import { User } from '../models/User.model';
import { Notification as NotificationModel } from '../models/Notification.model';
import { env } from '../config/env';
import mongoose, { FilterQuery } from 'mongoose';
import { createNotification } from '../services/notification.service';
import { getNotificationTemplate, NOTIFICATION_TEMPLATES } from '../utils/notificationTemplates';

/**
 * @desc    Create payment intent
 * @route   POST /api/v1/payments/create-intent
 * @access  Protected
 */
export const createPaymentIntent = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    const { packageId, couponCode } = req.body;

    if (!packageId) {
      res.status(400).json({
        success: false,
        message: 'Package ID is required',
      });
      return;
    }

    const pkg = await Package.findById(packageId);
    if (!pkg || !pkg.isActive) {
      res.status(404).json({
        success: false,
        message: 'Package not found or inactive',
      });
      return;
    }

    let amount = pkg.price;
    let discountAmount = 0;
    let finalAmount = amount;
    let appliedCouponCode: string | undefined;

    if (couponCode) {
      const couponValidation = await Coupon.validateCoupon(couponCode, packageId);

      if (couponValidation.valid && couponValidation.coupon) {
        discountAmount = couponValidation.coupon.calculateDiscount(amount);
        finalAmount = amount - discountAmount;
        appliedCouponCode = couponValidation.coupon.code;
      }
    }

    const amountInCents = Math.round(finalAmount * 100);

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: pkg.currency.toLowerCase(),
        metadata: {
          userId: userId.toString(),
          packageId: packageId.toString(),
          ...(appliedCouponCode && { couponCode: appliedCouponCode }),
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      const payment = await Payment.create({
        userId: new mongoose.Types.ObjectId(userId),
        subscriptionId: new mongoose.Types.ObjectId(),
        amount,
        currency: pkg.currency,
        status: 'pending',
        paymentMethod: 'visa',
        stripePaymentIntentId: paymentIntent.id,
        couponCode: appliedCouponCode,
        discountAmount,
        finalAmount,
        metadata: {
          packageId: packageId.toString(),
        },
      });

      res.status(200).json({
        success: true,
        data: {
          clientSecret: paymentIntent.client_secret,
          paymentId: payment._id,
          amount: finalAmount,
          currency: pkg.currency,
          discountAmount,
        },
      });
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        message: 'Failed to create payment intent',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @desc    Confirm payment and create subscription
 * @route   POST /api/v1/payments/confirm
 * @access  Protected
 */
export const confirmPayment = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      res.status(400).json({
        success: false,
        message: 'Payment intent ID is required',
      });
      return;
    }

    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      const payment = await Payment.findOne({
        stripePaymentIntentId: paymentIntentId,
      });

      if (!payment) {
        res.status(404).json({
          success: false,
          message: 'Payment not found',
        });
        return;
      }

      if (paymentIntent.status === 'succeeded') {
        payment.status = 'completed';
        payment.transactionId = paymentIntent.id;
        await payment.save();

        const packageId = payment.metadata?.packageId as string;
        const pkg = await Package.findById(packageId);

        if (!pkg) {
          res.status(404).json({
            success: false,
            message: 'Package not found',
          });
          return;
        }

        const startDate = new Date();
        const endDate = new Date();

        if (pkg.periodType === 'month') {
          endDate.setMonth(endDate.getMonth() + pkg.periodCount);
        } else if (pkg.periodType === 'year') {
          endDate.setFullYear(endDate.getFullYear() + pkg.periodCount);
        }

        const subscription = await Subscription.create({
          userId: new mongoose.Types.ObjectId(userId),
          packageId,
          status: 'active',
          startDate,
          endDate,
          autoRenew: true,
          paymentMethod: payment.paymentMethod,
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payment.subscriptionId = subscription._id as any;
        await payment.save();

        await User.findByIdAndUpdate(new mongoose.Types.ObjectId(userId), {
          'subscription.packageId': packageId,
          'subscription.status': 'active',
          'subscription.startDate': startDate,
          'subscription.endDate': endDate,
          'subscription.autoRenew': true,
        });

        if (payment.couponCode) {
          const coupon = await Coupon.findByCode(payment.couponCode);
          if (coupon) {
            await coupon.use();
          }
        }

        await NotificationModel.create({
          userId: new mongoose.Types.ObjectId(userId),
          type: 'subscription',
          title: 'تم الدفع بنجاح',
          message: `تم تفعيل اشتراكك في ${pkg.name} بنجاح!`,
          icon: '✅',
          data: {
            paymentId: payment._id,
            subscriptionId: subscription._id,
            packageId: pkg._id,
            amount: payment.finalAmount,
          },
        });

        const populatedSubscription = await Subscription.findById(
          subscription._id
        ).populate('packageId');

        res.status(200).json({
          success: true,
          data: {
            payment,
            subscription: populatedSubscription,
          },
          message: 'Payment confirmed and subscription created successfully',
        });
      } else if (paymentIntent.status === 'requires_payment_method' ||
                 paymentIntent.status === 'requires_confirmation' ||
                 paymentIntent.status === 'requires_action') {
        res.status(200).json({
          success: false,
          message: 'Payment requires further action',
          status: paymentIntent.status,
        });
      } else {
        payment.status = 'failed';
        payment.failureReason = paymentIntent.last_payment_error?.message || 'Payment failed';
        await payment.save();

        await NotificationModel.create({
          userId: new mongoose.Types.ObjectId(userId),
          type: 'system',
          title: 'فشل الدفع',
          message: 'لم يتم إتمام عملية الدفع. يرجى المحاولة مرة أخرى.',
          icon: '❌',
          data: {
            paymentId: payment._id,
            failureReason: payment.failureReason,
          },
        });

        res.status(200).json({
          success: false,
          message: payment.failureReason,
          error: payment.failureReason,
        });
      }
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        message: 'Failed to confirm payment',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @desc    Validate coupon
 * @route   POST /api/v1/payments/validate-coupon
 * @access  Protected
 */
export const validateCoupon = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { code, packageId } = req.body;

    if (!code) {
      res.status(400).json({
        success: false,
        message: 'Coupon code is required',
      });
      return;
    }

    const pkg = await Package.findById(packageId);
    if (!pkg || !pkg.isActive) {
      res.status(404).json({
        success: false,
        message: 'Package not found or inactive',
      });
      return;
    }

    const couponValidation = await Coupon.validateCoupon(code, packageId);

    if (!couponValidation.valid) {
      res.status(400).json({
        success: false,
        valid: false,
        message: couponValidation.message,
      });
      return;
    }

    const discount = couponValidation.coupon!.calculateDiscount(pkg.price);
    const finalAmount = pkg.price - discount;

    res.status(200).json({
      success: true,
      valid: true,
      data: {
        code: couponValidation.coupon!.code,
        discountType: couponValidation.coupon!.discountType,
        discountValue: couponValidation.coupon!.discountValue,
        discount,
        originalAmount: pkg.price,
        finalAmount,
      },
    });
  }
);

/**
 * @desc    Get payment methods
 * @route   GET /api/v1/payments/methods
 * @access  Protected
 */
export const getPaymentMethods = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const paymentMethods = [
      {
        type: 'card',
        label: 'Visa/MasterCard',
        icon: 'credit_card',
        enabled: true,
      },
      {
        type: 'apple-pay',
        label: 'Apple Pay',
        icon: 'apple',
        enabled: true,
      },
    ];

    res.status(200).json({
      success: true,
      data: paymentMethods,
    });
  }
);

/**
 * @desc    Get payment history
 * @route   GET /api/v1/users/payments/history
 * @access  Protected
 */
export const getPaymentHistory = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { page = 1, limit = 20, status } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const query: FilterQuery<IPayment> = { userId };
    if (status) {
      query.status = status as 'pending' | 'completed' | 'failed' | 'refunded';
    }

    const payments = await Payment.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('subscriptionId');

    const total = await Payment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: payments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  }
);

/**
 * @desc    Stripe webhook handler
 * @route   POST /api/v1/payments/webhook
 * @access  Public (Stripe signed)
 */
export const handleStripeWebhook = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const sig = req.headers['stripe-signature'] as string;

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err: unknown) {
      res.status(400).json({
        success: false,
        message: `Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
      return;
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;

        const payment = await Payment.findOne({
          stripePaymentIntentId: paymentIntent.id,
        });

        if (payment && payment.status === 'pending') {
          payment.status = 'completed';
          payment.transactionId = paymentIntent.id;
          await payment.save();

          const packageId = payment.metadata?.packageId as string;
          const pkg = await Package.findById(packageId);

          if (pkg) {
            const startDate = new Date();
            const endDate = new Date();

            if (pkg.periodType === 'month') {
              endDate.setMonth(endDate.getMonth() + pkg.periodCount);
            } else if (pkg.periodType === 'year') {
              endDate.setFullYear(endDate.getFullYear() + pkg.periodCount);
            }

            const subscription = await Subscription.create({
              userId: payment.userId,
              packageId,
              status: 'active',
              startDate,
              endDate,
              autoRenew: true,
              paymentMethod: payment.paymentMethod,
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payment.subscriptionId = subscription._id as any;
            await payment.save();

            await User.findByIdAndUpdate(payment.userId, {
              'subscription.packageId': packageId,
              'subscription.status': 'active',
              'subscription.startDate': startDate,
              'subscription.endDate': endDate,
              'subscription.autoRenew': true,
            });

            if (payment.couponCode) {
              const coupon = await Coupon.findByCode(payment.couponCode);
              if (coupon) {
                await coupon.use();
              }
            }

            const notificationData = getNotificationTemplate(
              NOTIFICATION_TEMPLATES.SUBSCRIPTION_ACTIVATED,
              {
                packageName: pkg.name,
                packageNameAr: pkg.name,
              }
            );

            if (notificationData) {
              notificationData.data = {
                paymentId: String(payment._id),
                subscriptionId: String(subscription._id),
                packageId: String(pkg._id),
              };
              await createNotification(String(payment.userId), notificationData);
            }
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;

        const payment = await Payment.findOne({
          stripePaymentIntentId: paymentIntent.id,
        });

        if (payment) {
          payment.status = 'failed';
          payment.failureReason = paymentIntent.last_payment_error?.message || 'Payment failed';
          await payment.save();

          const notificationData = getNotificationTemplate(
            NOTIFICATION_TEMPLATES.PAYMENT_FAILED,
            {}
          );

          if (notificationData) {
            notificationData.data = {
              paymentId: String(payment._id),
              failureReason: payment.failureReason,
            };
            await createNotification(String(payment.userId), notificationData);
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.status(200).json({ received: true });
  }
);

/**
 * @desc    Refund payment (Admin)
 * @route   POST /api/v1/admin/payments/:paymentId/refund
 * @access  Protected (Admin)
 */
export const refundPayment = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { paymentId } = req.params;
    const { reason } = req.body;

    const payment = await Payment.findById(paymentId);

    if (!payment) {
      res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
      return;
    }

    if (payment.status !== 'completed') {
      res.status(400).json({
        success: false,
        message: 'Only completed payments can be refunded',
      });
      return;
    }

    try {
      const refund = await stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId!,
        reason: 'requested_by_customer',
      });

      payment.status = 'refunded';
      payment.metadata = {
        ...payment.metadata,
        refundId: refund.id,
        refundReason: reason,
        refundDate: new Date(),
      };
      await payment.save();

      const subscription = await Subscription.findById(payment.subscriptionId);
      if (subscription && subscription.status === 'active') {
        subscription.status = 'cancelled';
        subscription.endDate = new Date();
        await subscription.save();

        await User.findByIdAndUpdate(payment.userId, {
          'subscription.status': 'cancelled',
          'subscription.endDate': new Date(),
        });
      }

      await NotificationModel.create({
        userId: payment.userId,
        type: 'subscription',
        title: 'تم استرداد المبلغ',
        message: `تم استرداد مبلغ ${payment.finalAmount} ${payment.currency}`,
        icon: '💰',
        data: {
          paymentId: payment._id,
          refundId: refund.id,
          amount: payment.finalAmount,
        },
      });

      res.status(200).json({
        success: true,
        data: {
          payment,
          refund,
        },
        message: 'Payment refunded successfully',
      });
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        message: 'Failed to process refund',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @desc    Create test payment (Development only)
 * @route   POST /api/v1/payments/test-payment
 * @access  Protected
 */
export const createTestPayment = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    // Only allow in development mode
    if (env.NODE_ENV !== 'development') {
      res.status(403).json({
        success: false,
        message: 'Test payments are only available in development mode',
      });
      return;
    }

    const userId = req.user?.id;
    const { packageId, couponCode, cardNumber } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    if (!packageId) {
      res.status(400).json({
        success: false,
        message: 'Package ID is required',
      });
      return;
    }

    // Accept test card numbers
    const testCardNumbers = [
      '4242424242424242', // Visa
      '5555555555554444', // Mastercard
      '378282246310005',  // Amex
      '6011111111111117', // Discover
      '4000056655665556', // Visa (debit)
    ];

    if (cardNumber && !testCardNumbers.includes(cardNumber.replace(/\s/g, ''))) {
      res.status(400).json({
        success: false,
        message: 'Invalid test card number. Use 4242424242424242 for testing',
      });
      return;
    }

    const pkg = await Package.findById(packageId);
    if (!pkg || !pkg.isActive) {
      res.status(404).json({
        success: false,
        message: 'Package not found or inactive',
      });
      return;
    }

    let amount = pkg.price;
    let discountAmount = 0;
    let finalAmount = amount;
    let appliedCouponCode: string | undefined;

    if (couponCode) {
      const couponValidation = await Coupon.validateCoupon(couponCode, packageId);

      if (couponValidation.valid && couponValidation.coupon) {
        discountAmount = couponValidation.coupon.calculateDiscount(amount);
        finalAmount = amount - discountAmount;
        appliedCouponCode = couponValidation.coupon.code;
      }
    }

    // Create test payment with completed status
    const payment = await Payment.create({
      userId: new mongoose.Types.ObjectId(userId),
      subscriptionId: new mongoose.Types.ObjectId(),
      amount,
      currency: pkg.currency,
      status: 'completed',
      paymentMethod: 'visa',
      transactionId: `test_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      couponCode: appliedCouponCode,
      discountAmount,
      finalAmount,
      metadata: {
        packageId: packageId.toString(),
        testPayment: true,
      },
    });

    // Create subscription
    const startDate = new Date();
    const endDate = new Date();

    if (pkg.periodType === 'month') {
      endDate.setMonth(endDate.getMonth() + pkg.periodCount);
    } else if (pkg.periodType === 'year') {
      endDate.setFullYear(endDate.getFullYear() + pkg.periodCount);
    }

    const subscription = await Subscription.create({
      userId: new mongoose.Types.ObjectId(userId),
      packageId,
      status: 'active',
      startDate,
      endDate,
      autoRenew: true,
      paymentMethod: payment.paymentMethod,
    });

    // Update payment with subscription ID
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payment.subscriptionId = subscription._id as any;
    await payment.save();

    // Update user subscription info
    await User.findByIdAndUpdate(new mongoose.Types.ObjectId(userId), {
      'subscription.packageId': packageId,
      'subscription.status': 'active',
      'subscription.startDate': startDate,
      'subscription.endDate': endDate,
      'subscription.autoRenew': true,
    });

    // Use coupon if provided
    if (appliedCouponCode) {
      const coupon = await Coupon.findByCode(appliedCouponCode);
      if (coupon) {
        await coupon.use();
      }
    }

    // Create notification
    await NotificationModel.create({
      userId: new mongoose.Types.ObjectId(userId),
      type: 'subscription',
      title: 'تم الدفع بنجاح (اختبار)',
      message: `تم تفعيل اشتراكك في ${pkg.name} بنجاح! (دفع تجريبي)`,
      icon: '✅',
      data: {
        paymentId: payment._id,
        subscriptionId: subscription._id,
        packageId: pkg._id,
        amount: payment.finalAmount,
        testPayment: true,
      },
    });

    const populatedSubscription = await Subscription.findById(
      subscription._id
    ).populate('packageId');

    res.status(200).json({
      success: true,
      data: {
        payment,
        subscription: populatedSubscription,
      },
      message: 'Test payment completed successfully',
    });
  }
);

/**
 * @desc    Get payment analytics (Admin)
 * @route   GET /api/v1/admin/payments/analytics
 * @access  Protected (Admin)
 */
export const getPaymentAnalytics = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { startDate, endDate } = req.query;

    const query: FilterQuery<IPayment> = {};

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt = { ...query.createdAt, $gte: new Date(startDate as string) };
      }
      if (endDate) {
        query.createdAt = { ...query.createdAt, $lte: new Date(endDate as string) };
      }
    }

    const allPayments = await Payment.find(query);
    const completedPayments = allPayments.filter(p => p.status === 'completed');
    const failedPayments = allPayments.filter(p => p.status === 'failed');
    const refundedPayments = allPayments.filter(p => p.status === 'refunded');

    const totalRevenue = completedPayments.reduce((sum, p) => sum + p.finalAmount, 0);
    const totalRefunded = refundedPayments.reduce((sum, p) => sum + p.finalAmount, 0);
    const netRevenue = totalRevenue - totalRefunded;

    const successRate = allPayments.length > 0
      ? (completedPayments.length / allPayments.length) * 100
      : 0;

    const failureRate = allPayments.length > 0
      ? (failedPayments.length / allPayments.length) * 100
      : 0;

    const averageTransactionValue = completedPayments.length > 0
      ? totalRevenue / completedPayments.length
      : 0;

    const revenueByMonth: Record<string, number> = {};
    completedPayments.forEach(payment => {
      const month = payment.createdAt.toISOString().substring(0, 7);
      revenueByMonth[month] = (revenueByMonth[month] || 0) + payment.finalAmount;
    });

    const packageIds = completedPayments
      .map(p => p.metadata?.packageId as string)
      .filter(Boolean);

    const packages = await Package.find({ _id: { $in: packageIds } });
    const revenueByPackage: Record<string, { revenue: number; count: number }> = {};

    completedPayments.forEach(payment => {
      const packageId = payment.metadata?.packageId as string;
      const pkg = packages.find(p => String(p._id) === packageId);
      const packageName = pkg?.name || 'Unknown';

      if (!revenueByPackage[packageName]) {
        revenueByPackage[packageName] = { revenue: 0, count: 0 };
      }
      revenueByPackage[packageName].revenue += payment.finalAmount;
      revenueByPackage[packageName].count += 1;
    });

    res.status(200).json({
      success: true,
      data: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalRefunded: Math.round(totalRefunded * 100) / 100,
        netRevenue: Math.round(netRevenue * 100) / 100,
        totalTransactions: allPayments.length,
        completedTransactions: completedPayments.length,
        failedTransactions: failedPayments.length,
        refundedTransactions: refundedPayments.length,
        successRate: Math.round(successRate * 100) / 100,
        failureRate: Math.round(failureRate * 100) / 100,
        averageTransactionValue: Math.round(averageTransactionValue * 100) / 100,
        revenueByMonth,
        revenueByPackage,
      },
    });
  }
);
