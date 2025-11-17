import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ISearchLog extends Document {
  query: string;
  userId?: mongoose.Types.ObjectId;
  type: 'all' | 'track' | 'program';
  filters: {
    category?: string;
    level?: string;
    relaxationType?: string;
    minDuration?: number;
    maxDuration?: number;
    minSessions?: number;
    maxSessions?: number;
    isPremium?: boolean;
  };
  resultCount: number;
  tracksCount: number;
  programsCount: number;
  timestamp: Date;
  userAgent?: string;
  ip?: string;
}

export interface ISearchLogModel extends Model<ISearchLog> {
  getPopularSearches(limit?: number, days?: number): Promise<Array<{ query: string; count: number }>>;
  getNoResultSearches(limit?: number, days?: number): Promise<Array<{ query: string; count: number }>>;
}

const searchLogSchema = new Schema<ISearchLog>(
  {
    query: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    type: {
      type: String,
      enum: ['all', 'track', 'program'],
      default: 'all',
      index: true,
    },
    filters: {
      category: { type: String },
      level: { type: String },
      relaxationType: { type: String },
      minDuration: { type: Number },
      maxDuration: { type: Number },
      minSessions: { type: Number },
      maxSessions: { type: Number },
      isPremium: { type: Boolean },
    },
    resultCount: {
      type: Number,
      required: true,
      default: 0,
    },
    tracksCount: {
      type: Number,
      default: 0,
    },
    programsCount: {
      type: Number,
      default: 0,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    userAgent: { type: String },
    ip: { type: String },
  },
  {
    timestamps: true,
  }
);

// Indexes for analytics queries
searchLogSchema.index({ query: 1, timestamp: -1 });
searchLogSchema.index({ userId: 1, timestamp: -1 });
searchLogSchema.index({ type: 1, timestamp: -1 });

// Static method to get popular searches
searchLogSchema.statics.getPopularSearches = async function (
  limit: number = 10,
  days: number = 7
): Promise<Array<{ query: string; count: number }>> {
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - days);

  return this.aggregate([
    {
      $match: {
        timestamp: { $gte: dateThreshold },
        query: { $ne: '' },
      },
    },
    {
      $group: {
        _id: '$query',
        count: { $sum: 1 },
      },
    },
    {
      $sort: { count: -1 },
    },
    {
      $limit: limit,
    },
    {
      $project: {
        _id: 0,
        query: '$_id',
        count: 1,
      },
    },
  ]);
};

// Static method to get searches with no results
searchLogSchema.statics.getNoResultSearches = async function (
  limit: number = 20,
  days: number = 7
): Promise<Array<{ query: string; count: number }>> {
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - days);

  return this.aggregate([
    {
      $match: {
        timestamp: { $gte: dateThreshold },
        resultCount: 0,
        query: { $ne: '' },
      },
    },
    {
      $group: {
        _id: '$query',
        count: { $sum: 1 },
      },
    },
    {
      $sort: { count: -1 },
    },
    {
      $limit: limit,
    },
    {
      $project: {
        _id: 0,
        query: '$_id',
        count: 1,
      },
    },
  ]);
};

export const SearchLog = mongoose.model<ISearchLog, ISearchLogModel>('SearchLog', searchLogSchema);
