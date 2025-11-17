import { Schema, model, Model, Document, FilterQuery, Query, QueryWithHelpers } from 'mongoose';
import timestampsPlugin from './plugins/timestamps';

// Coupon document interface
export interface ICoupon extends Document {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxUses: number | null;
  usedCount: number;
  validFrom: Date;
  validUntil: Date;
  isActive: boolean;
  applicablePackages?: Schema.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  isValid(): boolean;
  use(): Promise<ICoupon>;
  calculateDiscount(amount: number): number;
}

// Query helper types for Coupon
interface ICouponQueryHelpers {
  active(): QueryWithHelpers<ICoupon[], ICoupon, ICouponQueryHelpers>;
  expired(): QueryWithHelpers<ICoupon[], ICoupon, ICouponQueryHelpers>;
  available(): QueryWithHelpers<ICoupon[], ICoupon, ICouponQueryHelpers>;
}

// Coupon model interface with statics
interface ICouponModel extends Model<ICoupon, ICouponQueryHelpers> {
  findNotDeleted(conditions?: FilterQuery<ICoupon>): Query<ICoupon[], ICoupon>;
  findByCode(code: string): Query<ICoupon | null, ICoupon>;
  validateCoupon(
    code: string,
    packageId?: string
  ): Promise<{ valid: boolean; coupon?: ICoupon; message?: string }>;
}

// Coupon schema
const CouponSchema = new Schema<ICoupon, ICouponModel, Record<string, never>, ICouponQueryHelpers>(
  {
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [3, 'Coupon code must be at least 3 characters'],
      maxlength: [20, 'Coupon code cannot exceed 20 characters'],
      index: true,
    },
    discountType: {
      type: String,
      required: [true, 'Discount type is required'],
      enum: {
        values: ['percentage', 'fixed'],
        message: '{VALUE} is not a valid discount type',
      },
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [0, 'Discount value cannot be negative'],
      validate: {
        validator: function (value: number) {
          // If percentage, must be between 0 and 100
          if (this.discountType === 'percentage') {
            return value > 0 && value <= 100;
          }
          return value > 0;
        },
        message: 'Invalid discount value for the specified discount type',
      },
    },
    maxUses: {
      type: Number,
      default: null,
      // null means unlimited uses
      min: [1, 'Max uses must be at least 1 if specified'],
    },
    usedCount: {
      type: Number,
      default: 0,
      min: [0, 'Used count cannot be negative'],
    },
    validFrom: {
      type: Date,
      default: Date.now,
    },
    validUntil: {
      type: Date,
      required: [true, 'Valid until date is required'],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    applicablePackages: {
      type: [Schema.Types.ObjectId],
      ref: 'Package',
      // Empty array or null means applicable to all packages
    },
  },
  {
    timestamps: false, // We're using the timestamps plugin
  }
);

// Apply timestamps plugin
CouponSchema.plugin(timestampsPlugin);

// Indexes
// Note: code, isActive indexes are automatically created via unique/index constraints in field definitions
CouponSchema.index({ validUntil: 1 });

// Validation: validUntil must be after validFrom
CouponSchema.pre('validate', function (next) {
  if (this.validUntil <= this.validFrom) {
    return next(
      new Error('Valid until date must be after valid from date')
    );
  }
  next();
});

// Method to check if coupon is valid
CouponSchema.methods.isValid = function (): boolean {
  const now = new Date();

  // Check if active
  if (!this.isActive) {
    return false;
  }

  // Check date range
  if (now < this.validFrom || now > this.validUntil) {
    return false;
  }

  // Check usage limit
  if (this.maxUses !== null && this.usedCount >= this.maxUses) {
    return false;
  }

  return true;
};

// Method to increment usage count
CouponSchema.methods.use = async function (): Promise<ICoupon> {
  if (!this.isValid()) {
    throw new Error('Coupon is not valid');
  }

  this.usedCount += 1;
  return this.save();
};

// Method to calculate discount amount
CouponSchema.methods.calculateDiscount = function (amount: number): number {
  if (!this.isValid()) {
    return 0;
  }

  if (this.discountType === 'percentage') {
    return (amount * this.discountValue) / 100;
  } else {
    // Fixed discount
    return Math.min(this.discountValue, amount);
  }
};

// Query helpers
CouponSchema.query.active = function (this: QueryWithHelpers<ICoupon[], ICoupon, ICouponQueryHelpers>) {
  const now = new Date();
  return this.where({
    isActive: true,
    validFrom: { $lte: now },
    validUntil: { $gte: now },
  });
};

CouponSchema.query.expired = function (this: QueryWithHelpers<ICoupon[], ICoupon, ICouponQueryHelpers>) {
  const now = new Date();
  return this.where({
    validUntil: { $lt: now },
  });
};

CouponSchema.query.available = function (this: QueryWithHelpers<ICoupon[], ICoupon, ICouponQueryHelpers>) {
  const now = new Date();
  return this.where({
    isActive: true,
    validFrom: { $lte: now },
    validUntil: { $gte: now },
    $or: [{ maxUses: null }, { $expr: { $lt: ['$usedCount', '$maxUses'] } }],
  });
};

// Static methods
CouponSchema.statics.findByCode = function (code: string) {
  return this.findOne({ code: code.toUpperCase() });
};

CouponSchema.statics.validateCoupon = async function (
  code: string,
  packageId?: string
): Promise<{ valid: boolean; coupon?: ICoupon; message?: string }> {
  const coupon = await this.findByCode(code);

  if (!coupon) {
    return { valid: false, message: 'Coupon not found' };
  }

  if (!coupon.isValid()) {
    return { valid: false, message: 'Coupon is not valid or has expired' };
  }

  // Check if coupon is applicable to the package
  if (
    packageId &&
    coupon.applicablePackages &&
    coupon.applicablePackages.length > 0
  ) {
    const isApplicable = coupon.applicablePackages.some(
      (id: Schema.Types.ObjectId) => id.toString() === packageId
    );

    if (!isApplicable) {
      return {
        valid: false,
        message: 'Coupon is not applicable to this package',
      };
    }
  }

  return { valid: true, coupon };
};

// Create and export the Coupon model
export const Coupon = model<ICoupon, ICouponModel>('Coupon', CouponSchema);

export default Coupon;
