import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { Package, IPackage } from '../models/Package.model';
import { Subscription } from '../models/Subscription.model';
import { User } from '../models/User.model';
import { Notification } from '../models/Notification.model';
import { cacheGet, cacheSet } from '../config/redis';
import { Schema } from 'mongoose';

/**
 * @desc    Get all subscription packages
 * @route   GET /api/v1/subscriptions/packages
 * @access  Public
 */
export const getPackages = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const cacheKey = 'subscription:packages:active';

    const cachedPackages = await cacheGet<IPackage[]>(cacheKey);
    if (cachedPackages) {
      res.status(200).json({
        success: true,
        data: cachedPackages,
        count: cachedPackages.length,
        cached: true,
      });
      return;
    }

    const packages = await Package.find({ isActive: true }).sort({
      displayOrder: 1,
    });

    await cacheSet(cacheKey, packages, 3600);

    res.status(200).json({
      success: true,
      data: packages,
      count: packages.length,
      cached: false,
    });
  }
);

/**
 * @desc    Get user's current subscription
 * @route   GET /api/v1/users/subscription
 * @access  Protected
 */
export const getUserSubscription = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;

    const subscription = await Subscription.findOne({
      userId,
      status: 'active',
    }).populate('packageId');

    if (!subscription) {
      res.status(200).json({
        success: true,
        data: null,
        message: 'User is on free tier',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: subscription,
    });
  }
);

/**
 * @desc    Subscribe to a package
 * @route   POST /api/v1/subscriptions/subscribe
 * @access  Protected
 */
export const subscribeToPackage = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { packageId, paymentMethodId } = req.body;

    const pkg = await Package.findById(packageId);
    if (!pkg || !pkg.isActive) {
      res.status(404).json({
        success: false,
        message: 'Package not found or inactive',
      });
      return;
    }

    const existingSubscription = await Subscription.findOne({
      userId,
      status: 'active',
    });

    if (existingSubscription) {
      res.status(400).json({
        success: false,
        message:
          'User already has an active subscription. Use upgrade endpoint to change package.',
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
      userId,
      packageId,
      status: 'active',
      startDate,
      endDate,
      autoRenew: true,
      paymentMethod: paymentMethodId,
    });

    await User.findByIdAndUpdate(userId, {
      'subscription.packageId': packageId,
      'subscription.status': 'active',
      'subscription.startDate': startDate,
      'subscription.endDate': endDate,
      'subscription.autoRenew': true,
    });

    await Notification.create({
      userId,
      type: 'subscription',
      title: 'اشتراك مفعّل',
      message: `تم تفعيل اشتراكك في ${pkg.name} بنجاح!`,
      icon: '🎉',
      data: {
        subscriptionId: subscription._id,
        packageId: pkg._id,
      },
    });

    const populatedSubscription = await Subscription.findById(
      subscription._id
    ).populate('packageId');

    res.status(201).json({
      success: true,
      data: populatedSubscription,
      message: 'Subscription created successfully',
    });
  }
);

/**
 * @desc    Cancel subscription
 * @route   POST /api/v1/subscriptions/cancel
 * @access  Protected
 */
export const cancelSubscription = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;

    const subscription = await Subscription.findOne({
      userId,
      status: 'active',
    });

    if (!subscription) {
      res.status(404).json({
        success: false,
        message: 'No active subscription found',
      });
      return;
    }

    await subscription.cancel();

    await Notification.create({
      userId,
      type: 'subscription',
      title: 'تم إلغاء الاشتراك',
      message: `سيستمر اشتراكك حتى ${subscription.endDate.toLocaleDateString('ar-SA')}`,
      icon: 'ℹ️',
      data: {
        subscriptionId: subscription._id,
        endDate: subscription.endDate,
        cancellationDate: subscription.cancellationDate,
      },
    });

    const populatedSubscription = await Subscription.findById(
      subscription._id
    ).populate('packageId');

    res.status(200).json({
      success: true,
      data: populatedSubscription,
      message: 'Subscription cancelled. Remains active until end date.',
    });
  }
);

/**
 * @desc    Renew subscription
 * @route   POST /api/v1/subscriptions/renew
 * @access  Protected
 */
export const renewSubscription = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { packageId } = req.body;

    const subscription = await Subscription.findOne({ userId }).populate(
      'packageId'
    );

    if (!subscription) {
      res.status(404).json({
        success: false,
        message: 'No subscription found',
      });
      return;
    }

    const newPackageId = packageId || (subscription.packageId as unknown as IPackage)?._id || subscription.packageId;
    const pkg = await Package.findById(newPackageId);

    if (!pkg || !pkg.isActive) {
      res.status(404).json({
        success: false,
        message: 'Package not found or inactive',
      });
      return;
    }

    const newEndDate = new Date(
      subscription.endDate > new Date()
        ? subscription.endDate
        : new Date()
    );

    if (pkg.periodType === 'month') {
      newEndDate.setMonth(newEndDate.getMonth() + pkg.periodCount);
    } else if (pkg.periodType === 'year') {
      newEndDate.setFullYear(newEndDate.getFullYear() + pkg.periodCount);
    }

    subscription.packageId = newPackageId as Schema.Types.ObjectId;
    subscription.status = 'active';
    subscription.endDate = newEndDate;
    subscription.autoRenew = true;

    await subscription.save();

    await User.findByIdAndUpdate(userId, {
      'subscription.packageId': newPackageId,
      'subscription.status': 'active',
      'subscription.endDate': newEndDate,
      'subscription.autoRenew': true,
    });

    await Notification.create({
      userId,
      type: 'subscription',
      title: 'تم تجديد الاشتراك',
      message: `تم تجديد اشتراكك في ${pkg.name} حتى ${newEndDate.toLocaleDateString('ar-SA')}`,
      icon: '✅',
      data: {
        subscriptionId: subscription._id,
        packageId: pkg._id,
      },
    });

    const populatedSubscription = await Subscription.findById(
      subscription._id
    ).populate('packageId');

    res.status(200).json({
      success: true,
      data: populatedSubscription,
      message: 'Subscription renewed successfully',
    });
  }
);

/**
 * @desc    Upgrade/Downgrade subscription
 * @route   PUT /api/v1/subscriptions/upgrade
 * @access  Protected
 */
export const upgradeSubscription = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    const { newPackageId } = req.body;

    const subscription = await Subscription.findOne({
      userId,
      status: 'active',
    }).populate('packageId');

    if (!subscription) {
      res.status(404).json({
        success: false,
        message: 'No active subscription found',
      });
      return;
    }

    const newPackage = await Package.findById(newPackageId);
    if (!newPackage || !newPackage.isActive) {
      res.status(404).json({
        success: false,
        message: 'Package not found or inactive',
      });
      return;
    }

    const oldPackage = subscription.packageId as unknown as IPackage;

    if (String(oldPackage._id || oldPackage) === newPackageId) {
      res.status(400).json({
        success: false,
        message: 'Already subscribed to this package',
      });
      return;
    }

    const now = new Date();
    const daysRemaining = Math.ceil(
      (subscription.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    const oldPackageDaysTotal =
      oldPackage.periodType === 'month'
        ? oldPackage.periodCount * 30
        : oldPackage.periodCount * 365;
    const oldPackagePricePerDay = oldPackage.price / oldPackageDaysTotal;

    const newPackageDaysTotal =
      newPackage.periodType === 'month'
        ? newPackage.periodCount * 30
        : newPackage.periodCount * 365;
    const newPackagePricePerDay = newPackage.price / newPackageDaysTotal;

    const remainingCredit = daysRemaining * oldPackagePricePerDay;

    const creditDays = Math.floor(remainingCredit / newPackagePricePerDay);

    const newEndDate = new Date(now);
    newEndDate.setDate(newEndDate.getDate() + creditDays);

    const prorationAmount = remainingCredit - creditDays * newPackagePricePerDay;

    subscription.packageId = newPackageId;
    subscription.endDate = newEndDate;
    await subscription.save();

    await User.findByIdAndUpdate(userId, {
      'subscription.packageId': newPackageId,
      'subscription.endDate': newEndDate,
    });

    await Notification.create({
      userId,
      type: 'subscription',
      title: 'تم تحديث الاشتراك',
      message: `تم تحديث اشتراكك إلى ${newPackage.name}. تم تطبيق رصيد ${remainingCredit.toFixed(2)}$ على الاشتراك الجديد.`,
      icon: '🔄',
      data: {
        subscriptionId: subscription._id,
        oldPackageId: oldPackage._id,
        newPackageId: newPackage._id,
        prorationCredit: remainingCredit,
        prorationAmount,
        newEndDate,
        creditDays,
      },
    });

    const populatedSubscription = await Subscription.findById(
      subscription._id
    ).populate('packageId');

    res.status(200).json({
      success: true,
      data: populatedSubscription,
      proration: {
        remainingCredit: Math.round(remainingCredit * 100) / 100,
        creditDays,
        prorationAmount: Math.round(prorationAmount * 100) / 100,
        newEndDate,
      },
      message: 'Subscription upgraded successfully',
    });
  }
);

/**
 * @desc    Get subscription history
 * @route   GET /api/v1/users/subscriptions/history
 * @access  Protected
 */
export const getSubscriptionHistory = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;

    const subscriptions = await Subscription.find({ userId })
      .populate('packageId')
      .sort({ startDate: -1 });

    res.status(200).json({
      success: true,
      data: subscriptions,
      count: subscriptions.length,
    });
  }
);

/**
 * @desc    Get subscription statistics (Admin)
 * @route   GET /api/v1/admin/subscriptions/stats
 * @access  Protected (Admin)
 */
export const getSubscriptionStats = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const activeSubscriptions = await Subscription.find({
      status: 'active',
    }).populate('packageId');

    const subscriptionsByPackage: Record<string, number> = {};
    let mrr = 0;
    let arr = 0;
    let basicSubscriptions = 0;
    let premiumSubscriptions = 0;

    for (const sub of activeSubscriptions) {
      const pkg = sub.packageId as unknown as IPackage;
      const packageName = pkg?.name || 'Unknown';

      subscriptionsByPackage[packageName] =
        (subscriptionsByPackage[packageName] || 0) + 1;

      // Count Basic vs Premium
      if (packageName.toLowerCase().includes('basic') || packageName.toLowerCase().includes('أساسي')) {
        basicSubscriptions++;
      } else if (packageName.toLowerCase().includes('premium') || packageName.toLowerCase().includes('مميز') || packageName.toLowerCase().includes('متميز')) {
        premiumSubscriptions++;
      }

      if (pkg) {
        if (pkg.periodType === 'month') {
          mrr += pkg.price / pkg.periodCount;
          arr += (pkg.price / pkg.periodCount) * 12;
        } else if (pkg.periodType === 'year') {
          mrr += pkg.price / (pkg.periodCount * 12);
          arr += pkg.price / pkg.periodCount;
        }
      }
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const newSubscriptionsThisMonth = await Subscription.countDocuments({
      startDate: { $gte: startOfMonth, $lte: endOfMonth },
    });

    const cancelledSubscriptionsThisMonth = await Subscription.countDocuments({
      status: 'cancelled',
      updatedAt: { $gte: startOfMonth, $lte: endOfMonth },
    });

    const totalActiveSubscriptions = activeSubscriptions.length;
    const churnRate =
      totalActiveSubscriptions > 0
        ? (cancelledSubscriptionsThisMonth / totalActiveSubscriptions) * 100
        : 0;

    res.status(200).json({
      success: true,
      data: {
        totalActiveSubscriptions: totalActiveSubscriptions,
        activeSubscriptionsCount: totalActiveSubscriptions, // Backward compatibility
        basicSubscriptions,
        premiumSubscriptions,
        monthlyRecurringRevenue: Math.round(mrr * 100) / 100,
        annualRecurringRevenue: Math.round(arr * 100) / 100,
        mrr: Math.round(mrr * 100) / 100, // Backward compatibility
        arr: Math.round(arr * 100) / 100, // Backward compatibility
        subscriptionsByPackage,
        newSubscriptionsThisMonth,
        cancelledSubscriptionsThisMonth,
        churnRate: Math.round(churnRate * 100) / 100,
      },
    });
  }
);
