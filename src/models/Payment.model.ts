import { Schema, model, Model, Document, FilterQuery, Query, QueryWithHelpers } from 'mongoose';
import timestampsPlugin from './plugins/timestamps';

// Payment document interface
export interface IPayment extends Document {
  userId: Schema.Types.ObjectId;
  subscriptionId: Schema.Types.ObjectId;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentMethod: 'visa' | 'apple-pay';
  transactionId?: string;
  stripePaymentIntentId?: string;
  couponCode?: string;
  discountAmount: number;
  finalAmount: number;
  failureReason?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// Query helper types for Payment
interface IPaymentQueryHelpers {
  byUser(userId: string): QueryWithHelpers<IPayment[], IPayment, IPaymentQueryHelpers>;
  completed(): QueryWithHelpers<IPayment[], IPayment, IPaymentQueryHelpers>;
  pending(): QueryWithHelpers<IPayment[], IPayment, IPaymentQueryHelpers>;
  failed(): QueryWithHelpers<IPayment[], IPayment, IPaymentQueryHelpers>;
  refunded(): QueryWithHelpers<IPayment[], IPayment, IPaymentQueryHelpers>;
}

// Payment model interface with statics
interface IPaymentModel extends Model<IPayment, IPaymentQueryHelpers> {
  findNotDeleted(conditions?: FilterQuery<IPayment>): Query<IPayment[], IPayment>;
}

// Payment schema
const PaymentSchema = new Schema<IPayment, IPaymentModel, Record<string, never>, IPaymentQueryHelpers>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'Subscription',
      required: [true, 'Subscription ID is required'],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
    },
    status: {
      type: String,
      required: [true, 'Payment status is required'],
      enum: {
        values: ['pending', 'completed', 'failed', 'refunded'],
        message: '{VALUE} is not a valid payment status',
      },
      default: 'pending',
      index: true,
    },
    paymentMethod: {
      type: String,
      required: [true, 'Payment method is required'],
      enum: {
        values: ['visa', 'apple-pay'],
        message: '{VALUE} is not a valid payment method',
      },
    },
    transactionId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    stripePaymentIntentId: {
      type: String,
      // Stripe payment intent ID for tracking
    },
    couponCode: {
      type: String,
      uppercase: true,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: [0, 'Discount amount cannot be negative'],
    },
    finalAmount: {
      type: Number,
      required: [true, 'Final amount is required'],
      min: [0, 'Final amount cannot be negative'],
    },
    failureReason: {
      type: String,
      // Reason for payment failure
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
      // Additional payment-related data
    },
  },
  {
    timestamps: false, // We're using the timestamps plugin
  }
);

// Apply timestamps plugin
PaymentSchema.plugin(timestampsPlugin);

// Indexes
// Note: userId, subscriptionId, status, transactionId indexes are automatically created via unique/index constraints in field definitions
PaymentSchema.index({ createdAt: -1 });

// Compound indexes for queries
PaymentSchema.index({ userId: 1, status: 1 });
PaymentSchema.index({ userId: 1, createdAt: -1 });

// Pre-save validation
PaymentSchema.pre('save', function (next) {
  // Ensure finalAmount is calculated correctly
  if (this.isModified('amount') || this.isModified('discountAmount')) {
    this.finalAmount = Math.max(0, this.amount - this.discountAmount);
  }

  next();
});

// Query helpers
PaymentSchema.query.byUser = function (this: QueryWithHelpers<IPayment[], IPayment, IPaymentQueryHelpers>, userId: string) {
  return this.where({ userId });
};

PaymentSchema.query.completed = function (this: QueryWithHelpers<IPayment[], IPayment, IPaymentQueryHelpers>) {
  return this.where({ status: 'completed' });
};

PaymentSchema.query.pending = function (this: QueryWithHelpers<IPayment[], IPayment, IPaymentQueryHelpers>) {
  return this.where({ status: 'pending' });
};

PaymentSchema.query.failed = function (this: QueryWithHelpers<IPayment[], IPayment, IPaymentQueryHelpers>) {
  return this.where({ status: 'failed' });
};

PaymentSchema.query.refunded = function (this: QueryWithHelpers<IPayment[], IPayment, IPaymentQueryHelpers>) {
  return this.where({ status: 'refunded' });
};

// Static methods
PaymentSchema.statics.findUserPayments = function (
  userId: string,
  limit = 20
) {
  return this.find({ userId })
    .populate('subscriptionId')
    .sort({ createdAt: -1 })
    .limit(limit);
};

PaymentSchema.statics.findByTransactionId = function (transactionId: string) {
  return this.findOne({ transactionId }).populate('userId subscriptionId');
};

PaymentSchema.statics.getUserPaymentStats = async function (userId: string) {
  const payments = await this.find({ userId });

  const totalPaid = payments
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + p.finalAmount, 0);

  const totalPayments = payments.length;
  const completedPayments = payments.filter(
    (p) => p.status === 'completed'
  ).length;
  const failedPayments = payments.filter((p) => p.status === 'failed').length;

  return {
    totalPaid,
    totalPayments,
    completedPayments,
    failedPayments,
  };
};

PaymentSchema.statics.getRevenueStats = async function (
  startDate?: Date,
  endDate?: Date
) {
  const query: FilterQuery<IPayment> = { status: 'completed' };

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt = { $gte: startDate, ...(query.createdAt as object) };
    if (endDate) query.createdAt = { ...(query.createdAt as object), $lte: endDate };
  }

  const payments = await this.find(query);

  const totalRevenue = payments.reduce((sum, p) => sum + p.finalAmount, 0);
  const totalTransactions = payments.length;
  const averageTransactionValue =
    totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  return {
    totalRevenue,
    totalTransactions,
    averageTransactionValue,
  };
};

// Create and export the Payment model
export const Payment = model<IPayment, IPaymentModel>('Payment', PaymentSchema);

export default Payment;
