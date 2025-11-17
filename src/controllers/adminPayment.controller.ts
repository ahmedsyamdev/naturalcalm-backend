import { Request, Response } from 'express';
import { Payment } from '../models/Payment.model';
import { User } from '../models/User.model';
import { Package } from '../models/Package.model';
import logger from '../utils/logger';
import { FilterQuery } from 'mongoose';

/**
 * Get all payments with filters (admin)
 * GET /api/v1/admin/payments
 */
export const getAllPayments = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '20',
      status,
      paymentMethod,
      startDate,
      endDate,
      search,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query: FilterQuery<typeof Payment> = {};

    // Filter by status
    if (status) {
      query.status = status as 'pending' | 'completed' | 'failed' | 'refunded';
    }

    // Filter by payment method
    if (paymentMethod) {
      query.paymentMethod = paymentMethod as string;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate as string);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate as string);
      }
    }

    // Search by transaction ID
    if (search) {
      query.$or = [
        { transactionId: { $regex: search, $options: 'i' } },
        { stripePaymentIntentId: { $regex: search, $options: 'i' } },
      ];
    }

    // Get payments with pagination
    const [payments, total] = await Promise.all([
      Payment.find(query)
        .populate('userId', 'name email phone')
        .populate('subscriptionId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Payment.countDocuments(query),
    ]);

    // Enrich payments with package information
    const enrichedPayments = await Promise.all(
      payments.map(async (payment) => {
        const packageId = payment.metadata?.packageId as string;
        let packageInfo = null;

        if (packageId) {
          const pkg = await Package.findById(packageId).select('name type').lean();
          if (pkg) {
            packageInfo = {
              id: String(pkg._id),
              name: pkg.name,
              type: pkg.type || 'subscription',
            };
          }
        }

        return {
          ...payment,
          id: String(payment._id),
          user: payment.userId
            ? {
                id: String((payment.userId as any)._id),
                name: (payment.userId as any).name,
                email: (payment.userId as any).email,
                phone: (payment.userId as any).phone,
              }
            : null,
          package: packageInfo,
          coupon: payment.couponCode
            ? {
                id: payment.couponCode,
                code: payment.couponCode,
              }
            : null,
          originalAmount: payment.amount,
          amount: payment.finalAmount,
          refundReason: payment.metadata?.refundReason,
          refundedAt: payment.metadata?.refundDate,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: enrichedPayments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    logger.error('Get all payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments',
    });
  }
};

/**
 * Get payment by ID (admin)
 * GET /api/v1/admin/payments/:id
 */
export const getPaymentById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const payment = await Payment.findById(id)
      .populate('userId', 'name email phone')
      .populate('subscriptionId')
      .lean();

    if (!payment) {
      res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
      return;
    }

    // Get package information
    const packageId = payment.metadata?.packageId as string;
    let packageInfo = null;

    if (packageId) {
      const pkg = await Package.findById(packageId).select('name type').lean();
      if (pkg) {
        packageInfo = {
          id: String(pkg._id),
          name: pkg.name,
          type: pkg.type || 'subscription',
        };
      }
    }

    const enrichedPayment = {
      ...payment,
      id: String(payment._id),
      user: payment.userId
        ? {
            id: String((payment.userId as any)._id),
            name: (payment.userId as any).name,
            email: (payment.userId as any).email,
            phone: (payment.userId as any).phone,
          }
        : null,
      package: packageInfo,
      coupon: payment.couponCode
        ? {
            id: payment.couponCode,
            code: payment.couponCode,
          }
        : null,
      originalAmount: payment.amount,
      amount: payment.finalAmount,
      refundReason: payment.metadata?.refundReason,
      refundedAt: payment.metadata?.refundDate,
    };

    res.status(200).json({
      success: true,
      data: enrichedPayment,
    });
  } catch (error) {
    logger.error('Get payment by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment',
    });
  }
};

/**
 * Export payments to CSV (admin)
 * GET /api/v1/admin/payments/export
 */
export const exportPayments = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { status, paymentMethod, startDate, endDate, search } = req.query;

    // Build query (same as getAllPayments)
    const query: FilterQuery<typeof Payment> = {};

    if (status) {
      query.status = status as 'pending' | 'completed' | 'failed' | 'refunded';
    }

    if (paymentMethod) {
      query.paymentMethod = paymentMethod as string;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate as string);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate as string);
      }
    }

    if (search) {
      query.$or = [
        { transactionId: { $regex: search, $options: 'i' } },
        { stripePaymentIntentId: { $regex: search, $options: 'i' } },
      ];
    }

    const payments = await Payment.find(query)
      .populate('userId', 'name email phone')
      .sort({ createdAt: -1 })
      .lean();

    // Enrich payments with package information
    const enrichedPayments = await Promise.all(
      payments.map(async (payment) => {
        const packageId = payment.metadata?.packageId as string;
        let packageName = 'Unknown';

        if (packageId) {
          const pkg = await Package.findById(packageId).select('name').lean();
          if (pkg) {
            packageName = pkg.name;
          }
        }

        return {
          transactionId: payment.transactionId || '',
          userName: (payment.userId as any)?.name || '',
          userEmail: (payment.userId as any)?.email || '',
          userPhone: (payment.userId as any)?.phone || '',
          packageName,
          amount: payment.amount,
          discountAmount: payment.discountAmount || 0,
          finalAmount: payment.finalAmount,
          currency: payment.currency,
          couponCode: payment.couponCode || '',
          paymentMethod: payment.paymentMethod,
          status: payment.status,
          createdAt: payment.createdAt.toISOString(),
        };
      })
    );

    // Generate CSV
    const headers = [
      'Transaction ID',
      'User Name',
      'User Email',
      'User Phone',
      'Package',
      'Amount',
      'Discount',
      'Final Amount',
      'Currency',
      'Coupon Code',
      'Payment Method',
      'Status',
      'Created At',
    ];

    const csvRows = [
      headers.join(','),
      ...enrichedPayments.map((payment) =>
        [
          payment.transactionId,
          payment.userName,
          payment.userEmail,
          payment.userPhone,
          payment.packageName,
          payment.amount,
          payment.discountAmount,
          payment.finalAmount,
          payment.currency,
          payment.couponCode,
          payment.paymentMethod,
          payment.status,
          payment.createdAt,
        ]
          .map((value) => `"${value}"`)
          .join(',')
      ),
    ];

    const csv = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=payments.csv');
    res.status(200).send(csv);
  } catch (error) {
    logger.error('Export payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export payments',
    });
  }
};
