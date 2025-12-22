import { Schema, model, Model, Document, FilterQuery, Query, QueryWithHelpers } from 'mongoose';
import timestampsPlugin from './plugins/timestamps';

// Package document interface
export interface IPackage extends Document {
  name: string;
  nameEn?: string;
  type: 'basic' | 'standard' | 'premium';
  price: number;
  currency: string;
  periodType: 'month' | 'year';
  periodCount: number;
  durationInDays: number; // Duration in days (e.g., 30, 365)
  discountPercentage: number;
  features: string[];
  isActive: boolean;
  displayOrder?: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  periodArabic: string; // Virtual field
  priceFormatted: string; // Virtual field
}

// Query helper types for Package
interface IPackageQueryHelpers {
  active(): QueryWithHelpers<IPackage[], IPackage, IPackageQueryHelpers>;
  byType(type: 'basic' | 'standard' | 'premium'): QueryWithHelpers<IPackage[], IPackage, IPackageQueryHelpers>;
}

// Package model interface with statics
interface IPackageModel extends Model<IPackage, IPackageQueryHelpers> {
  findNotDeleted(conditions?: FilterQuery<IPackage>): Query<IPackage[], IPackage>;
  findActivePackages(): Query<IPackage[], IPackage>;
}

// Package schema
const PackageSchema = new Schema<IPackage, IPackageModel, Record<string, never>, IPackageQueryHelpers>(
  {
    name: {
      type: String,
      required: [true, 'Package name is required'],
      trim: true,
      // e.g., "الاشتراك المتميز", "الباقة الأساسية"
    },
    nameEn: {
      type: String,
      trim: true,
      // e.g., "Premium Subscription", "Basic Package"
    },
    type: {
      type: String,
      required: [true, 'Package type is required'],
      enum: {
        values: ['basic', 'standard', 'premium'],
        message: '{VALUE} is not a valid package type',
      },
      unique: true,
      index: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    currency: {
      type: String,
      default: 'SAR',
      uppercase: true,
    },
    periodType: {
      type: String,
      required: [true, 'Period type is required'],
      enum: {
        values: ['month', 'year'],
        message: '{VALUE} is not a valid period type',
      },
    },
    periodCount: {
      type: Number,
      default: 1,
      min: [1, 'Period count must be at least 1'],
    },
    durationInDays: {
      type: Number,
      required: [true, 'Duration in days is required'],
      min: [1, 'Duration must be at least 1 day'],
      // e.g., 30 for monthly, 365 for yearly
    },
    discountPercentage: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
      max: [100, 'Discount cannot exceed 100%'],
    },
    features: {
      type: [String],
      default: [],
      // e.g., ["وصول غير محدود", "محتوى حصري", "بدون إعلانات"]
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: false, // We're using the timestamps plugin
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Apply timestamps plugin
PackageSchema.plugin(timestampsPlugin);

// Indexes
// Note: type, isActive indexes are automatically created via unique/index constraints in field definitions
PackageSchema.index({ displayOrder: 1 });

// Virtual field: periodArabic
PackageSchema.virtual('periodArabic').get(function () {
  const periodMap: Record<string, string> = {
    month: 'شهر',
    year: 'سنة',
  };

  const count = this.periodCount;
  const period = periodMap[this.periodType] || this.periodType;

  if (count === 1) {
    return period;
  }

  // For multiple periods, add the count (e.g., "3 أشهر", "2 سنة")
  const pluralMap: Record<string, string> = {
    month: 'أشهر',
    year: 'سنوات',
  };

  return `${count} ${pluralMap[this.periodType] || period}`;
});

// Virtual field: priceFormatted (e.g., "20$", "99.99$")
PackageSchema.virtual('priceFormatted').get(function () {
  const formattedPrice =
    this.price % 1 === 0 ? this.price.toString() : this.price.toFixed(2);

  // Currency symbol mapping
  const currencySymbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    SAR: 'ر.س',
    AED: 'د.إ',
  };

  const symbol = currencySymbols[this.currency] || this.currency;

  return `${formattedPrice}${symbol}`;
});

// Virtual field: effectivePrice (price after discount)
PackageSchema.virtual('effectivePrice').get(function () {
  if (this.discountPercentage > 0) {
    return this.price * (1 - this.discountPercentage / 100);
  }
  return this.price;
});

// Query helpers
PackageSchema.query.active = function (this: QueryWithHelpers<IPackage[], IPackage, IPackageQueryHelpers>) {
  return this.where({ isActive: true });
};

PackageSchema.query.byType = function (this: QueryWithHelpers<IPackage[], IPackage, IPackageQueryHelpers>, type: 'basic' | 'standard' | 'premium') {
  return this.where({ type });
};

// Static methods
PackageSchema.statics.getActivePackages = function () {
  return this.find({ isActive: true }).sort({ displayOrder: 1 });
};

PackageSchema.statics.getPremiumPackage = function () {
  return this.findOne({ type: 'premium', isActive: true });
};

PackageSchema.statics.getStandardPackage = function () {
  return this.findOne({ type: 'standard', isActive: true });
};

PackageSchema.statics.getBasicPackage = function () {
  return this.findOne({ type: 'basic', isActive: true });
};

// Create and export the Package model
export const Package = model<IPackage, IPackageModel>('Package', PackageSchema);

export default Package;
