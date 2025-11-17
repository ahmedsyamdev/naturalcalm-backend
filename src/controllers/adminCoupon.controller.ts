import { Request, Response } from 'express';
import { Coupon } from '../models/Coupon.model';
import { Payment } from '../models/Payment.model';
import logger from '../utils/logger';

/**
 * List all coupons with filters and pagination
 * GET /api/v1/admin/coupons
 */
export const listCoupons = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { page = '1', limit = '20', isActive } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query: Record<string, unknown> = { deletedAt: null };

    // Filter by active status
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    // Get coupons with pagination
    const [coupons, total] = await Promise.all([
      Coupon.find(query)
        .populate('applicablePackages', 'name price')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Coupon.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: coupons,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    logger.error('List coupons error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch coupons',
    });
  }
};

/**
 * Create coupon
 * POST /api/v1/admin/coupons
 */
export const createCoupon = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      code,
      discountType,
      discountValue,
      maxUses,
      validFrom,
      validUntil,
      applicablePackages,
    } = req.body;

    // Validate required fields
    if (!code || !discountType || !discountValue || !validUntil) {
      res.status(400).json({
        success: false,
        message:
          'Code, discount type, discount value, and valid until date are required',
      });
      return;
    }

    // Validate discount type
    if (discountType !== 'percentage' && discountType !== 'fixed') {
      res.status(400).json({
        success: false,
        message: 'Discount type must be either "percentage" or "fixed"',
      });
      return;
    }

    // Validate discount value
    if (discountValue <= 0) {
      res.status(400).json({
        success: false,
        message: 'Discount value must be greater than 0',
      });
      return;
    }

    if (discountType === 'percentage' && discountValue > 100) {
      res.status(400).json({
        success: false,
        message: 'Percentage discount cannot exceed 100',
      });
      return;
    }

    // Validate dates
    const validFromDate = validFrom ? new Date(validFrom) : new Date();
    const validUntilDate = new Date(validUntil);

    if (validUntilDate <= validFromDate) {
      res.status(400).json({
        success: false,
        message: 'Valid until date must be after valid from date',
      });
      return;
    }

    // Check if code already exists
    const existingCoupon = await Coupon.findOne({
      code: code.toUpperCase(),
    });

    if (existingCoupon) {
      res.status(400).json({
        success: false,
        message: 'Coupon code already exists',
      });
      return;
    }

    // Create coupon
    const coupon = await Coupon.create({
      code: code.toUpperCase(),
      discountType,
      discountValue,
      maxUses: maxUses || null,
      validFrom: validFromDate,
      validUntil: validUntilDate,
      applicablePackages: applicablePackages || [],
    });

    logger.info(`Admin ${req.user?.id} created coupon ${coupon.code}`);

    res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      data: { coupon },
    });
  } catch (error) {
    logger.error('Create coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create coupon',
    });
  }
};

/**
 * Update coupon
 * PUT /api/v1/admin/coupons/:couponId
 */
export const updateCoupon = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { couponId } = req.params;
    const updateData = req.body;

    // Fields that can be updated (code cannot be changed)
    const allowedFields = [
      'discountType',
      'discountValue',
      'maxUses',
      'validUntil',
      'isActive',
      'applicablePackages',
    ];

    // Filter update data to only allowed fields
    const filteredData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field];
      }
    }

    if (Object.keys(filteredData).length === 0) {
      res.status(400).json({
        success: false,
        message: 'No valid fields to update',
      });
      return;
    }

    // First, find the coupon to validate against existing data
    const coupon = await Coupon.findOne({ _id: couponId, deletedAt: null });

    if (!coupon) {
      res.status(404).json({
        success: false,
        message: 'Coupon not found',
      });
      return;
    }

    // Validate discount type and value combination
    const newDiscountType = (filteredData.discountType as 'percentage' | 'fixed') || coupon.discountType;
    const newDiscountValue = (filteredData.discountValue as number) ?? coupon.discountValue;

    if (newDiscountValue <= 0) {
      res.status(400).json({
        success: false,
        message: 'Discount value must be greater than 0',
      });
      return;
    }

    if (newDiscountType === 'percentage' && newDiscountValue > 100) {
      res.status(400).json({
        success: false,
        message: 'Percentage discount cannot exceed 100',
      });
      return;
    }

    // Validate validUntil date if being updated
    if (filteredData.validUntil) {
      const validUntilDate = new Date(filteredData.validUntil as string);
      if (validUntilDate <= coupon.validFrom) {
        res.status(400).json({
          success: false,
          message: 'Valid until date must be after valid from date',
        });
        return;
      }
    }

    // Update coupon fields
    Object.assign(coupon, filteredData);
    await coupon.save();

    // Populate the applicablePackages
    await coupon.populate('applicablePackages', 'name price');

    logger.info(`Admin ${req.user?.id} updated coupon ${coupon.code}`);

    res.status(200).json({
      success: true,
      data: { coupon },
      message: 'Coupon updated successfully',
    });
  } catch (error) {
    logger.error('Update coupon error:', error);
    console.error('Detailed update coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update coupon',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
};

/**
 * Delete coupon (soft delete or hard delete)
 * DELETE /api/v1/admin/coupons/:couponId
 */
export const deleteCoupon = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { couponId } = req.params;
    const { permanent = 'false' } = req.query;

    if (permanent === 'true') {
      // Hard delete
      const coupon = await Coupon.findByIdAndDelete(couponId);

      if (!coupon) {
        res.status(404).json({
          success: false,
          message: 'Coupon not found',
        });
        return;
      }

      logger.info(`Admin ${req.user?.id} permanently deleted coupon ${coupon.code}`);
    } else {
      // Soft delete by setting isActive to false
      const coupon = await Coupon.findOneAndUpdate(
        { _id: couponId, deletedAt: null },
        { $set: { isActive: false, deletedAt: new Date() } },
        { new: true }
      );

      if (!coupon) {
        res.status(404).json({
          success: false,
          message: 'Coupon not found',
        });
        return;
      }

      logger.info(`Admin ${req.user?.id} soft deleted coupon ${coupon.code}`);
    }

    res.status(200).json({
      success: true,
      message: 'Coupon deleted successfully',
    });
  } catch (error) {
    logger.error('Delete coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete coupon',
    });
  }
};

/**
 * Get coupon usage statistics
 * GET /api/v1/admin/coupons/:couponId/stats
 */
export const getCouponStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { couponId } = req.params;

    // Find coupon
    const coupon = await Coupon.findById(couponId);

    if (!coupon) {
      res.status(404).json({
        success: false,
        message: 'Coupon not found',
      });
      return;
    }

    // Find all payments that used this coupon
    logger.info(`Searching for payments with couponCode: ${coupon.code}`);
    const payments = await Payment.find({
      couponCode: coupon.code,
      status: 'completed',
    })
      .populate('userId', 'name email phone')
      .sort({ createdAt: -1 })
      .lean();

    logger.info(`Found ${payments.length} payments for coupon ${coupon.code}`);

    // Calculate statistics
    const totalUses = payments.length;
    const totalDiscountGiven = payments.reduce(
      (sum, payment) => sum + (payment.discountAmount || 0),
      0
    );
    const totalRevenue = payments.reduce(
      (sum, payment) => sum + (payment.finalAmount || 0),
      0
    );

    // Get unique users who used the coupon
    const uniqueUsers = [...new Set(payments.map((p) => p.userId.toString()))];

    // Calculate success rate (completed payments / all payments that used this coupon)
    const successRate = totalUses > 0 ? 100 : 0; // All payments in the result are completed, so 100%

    // Format users data for frontend
    const usersData = payments.slice(0, 10).map((payment) => ({
      id: String((payment.userId as any)._id),
      name: (payment.userId as any).name || 'Unknown',
      usedAt: payment.createdAt.toISOString(),
      discountAmount: payment.discountAmount || 0,
    }));

    res.status(200).json({
      success: true,
      data: {
        totalUses,
        totalDiscountGiven,
        successRate,
        users: usersData,
      },
    });
  } catch (error) {
    logger.error('Get coupon stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch coupon statistics',
    });
  }
};
