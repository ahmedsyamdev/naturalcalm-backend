import { Schema, model, Model, Document, FilterQuery, Query, QueryWithHelpers } from 'mongoose';
import timestampsPlugin from './plugins/timestamps';

// Subscription document interface
export interface ISubscription extends Document {
  userId: Schema.Types.ObjectId;
  packageId: Schema.Types.ObjectId;
  status: 'active' | 'expired' | 'cancelled';
  startDate: Date;
  endDate: Date;
  autoRenew: boolean;
  paymentMethod?: string;
  cancellationDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  daysRemaining: number; // Virtual field
  isActive: boolean; // Virtual field
  cancel(): Promise<ISubscription>;
  renew(newEndDate: Date): Promise<ISubscription>;
}

// Query helper types for Subscription
interface ISubscriptionQueryHelpers {
  active(): QueryWithHelpers<ISubscription[], ISubscription, ISubscriptionQueryHelpers>;
  expired(): QueryWithHelpers<ISubscription[], ISubscription, ISubscriptionQueryHelpers>;
  cancelled(): QueryWithHelpers<ISubscription[], ISubscription, ISubscriptionQueryHelpers>;
  autoRenew(): QueryWithHelpers<ISubscription[], ISubscription, ISubscriptionQueryHelpers>;
}

// Subscription model interface with statics
interface ISubscriptionModel extends Model<ISubscription, ISubscriptionQueryHelpers> {
  findNotDeleted(conditions?: FilterQuery<ISubscription>): Query<ISubscription[], ISubscription>;
  getUserSubscription(userId: string): Query<ISubscription | null, ISubscription>;
  checkExpiredSubscriptions(): Promise<number>;
}

// Subscription schema
const SubscriptionSchema = new Schema<ISubscription, ISubscriptionModel, Record<string, never>, ISubscriptionQueryHelpers>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      unique: true,
      index: true,
    },
    packageId: {
      type: Schema.Types.ObjectId,
      ref: 'Package',
      required: [true, 'Package ID is required'],
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: ['active', 'expired', 'cancelled'],
        message: '{VALUE} is not a valid subscription status',
      },
      default: 'active',
      index: true,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
      index: true,
    },
    autoRenew: {
      type: Boolean,
      default: true,
    },
    paymentMethod: {
      type: String,
      // e.g., 'visa', 'apple-pay'
    },
    cancellationDate: {
      type: Date,
      // Date when subscription was cancelled
    },
  },
  {
    timestamps: false, // We're using the timestamps plugin
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Apply timestamps plugin
SubscriptionSchema.plugin(timestampsPlugin);

// Indexes
// Note: userId, status, endDate indexes are automatically created via unique/index constraints in field definitions

// Compound index for queries
SubscriptionSchema.index({ status: 1, endDate: 1 });

// Virtual field: daysRemaining
SubscriptionSchema.virtual('daysRemaining').get(function () {
  const now = new Date();
  const end = new Date(this.endDate);
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
});

// Virtual field: isActive (check if current date < endDate and status is active)
SubscriptionSchema.virtual('isActive').get(function () {
  const now = new Date();
  return this.status === 'active' && this.endDate > now;
});

// Method to cancel subscription
SubscriptionSchema.methods.cancel = async function (): Promise<ISubscription> {
  this.autoRenew = false;
  this.cancellationDate = new Date();
  return this.save();
};

// Method to renew subscription
SubscriptionSchema.methods.renew = async function (
  newEndDate: Date
): Promise<ISubscription> {
  this.status = 'active';
  this.endDate = newEndDate;
  return this.save();
};

// Pre-save hook to auto-update status based on endDate
SubscriptionSchema.pre('save', function (next) {
  const now = new Date();

  // Auto-expire if end date has passed
  if (this.endDate < now && this.status === 'active') {
    this.status = 'expired';
  }

  // Reactivate if end date is in the future and was expired
  if (this.endDate > now && this.status === 'expired') {
    this.status = 'active';
  }

  next();
});

// Query helpers
SubscriptionSchema.query.active = function (this: QueryWithHelpers<ISubscription[], ISubscription, ISubscriptionQueryHelpers>) {
  return this.where({ status: 'active', endDate: { $gt: new Date() } });
};

SubscriptionSchema.query.expired = function (this: QueryWithHelpers<ISubscription[], ISubscription, ISubscriptionQueryHelpers>) {
  return this.where({
    $or: [{ status: 'expired' }, { endDate: { $lte: new Date() } }],
  });
};

SubscriptionSchema.query.cancelled = function (this: QueryWithHelpers<ISubscription[], ISubscription, ISubscriptionQueryHelpers>) {
  return this.where({ status: 'cancelled' });
};

SubscriptionSchema.query.autoRenew = function (this: QueryWithHelpers<ISubscription[], ISubscription, ISubscriptionQueryHelpers>) {
  return this.where({ autoRenew: true });
};

// Static methods
SubscriptionSchema.statics.findActiveByUser = function (userId: string) {
  return this.findOne({
    userId,
    status: 'active',
    endDate: { $gt: new Date() },
  }).populate('packageId');
};

SubscriptionSchema.statics.findExpiringSubscriptions = function (days = 7) {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);

  return this.find({
    status: 'active',
    endDate: { $gt: now, $lte: futureDate },
    autoRenew: false,
  }).populate('userId packageId');
};

SubscriptionSchema.statics.checkAndUpdateExpired = async function () {
  const now = new Date();

  const result = await this.updateMany(
    {
      status: 'active',
      endDate: { $lte: now },
    },
    {
      $set: { status: 'expired' },
    }
  );

  return result;
};

// Create and export the Subscription model
export const Subscription = model<ISubscription, ISubscriptionModel>(
  'Subscription',
  SubscriptionSchema
);

export default Subscription;
