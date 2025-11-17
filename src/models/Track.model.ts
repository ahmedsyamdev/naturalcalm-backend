import { Schema, model, Model, Document, FilterQuery, Query, QueryWithHelpers } from 'mongoose';
import timestampsPlugin from './plugins/timestamps';

// Track document interface
export interface ITrack extends Document {
  title: string;
  description?: string;
  durationSeconds: number;
  level: 'مبتدأ' | 'متوسط' | 'متقدم';
  category: Schema.Types.ObjectId;
  relaxationType?: 'استرخاء صباحي' | 'استرخاء مسائي';
  imageUrl: string;
  audioUrl: string;
  audioKey?: string;
  playCount: number;
  isPremium: boolean; // Deprecated: Use contentAccess instead
  contentAccess: 'free' | 'basic' | 'premium';
  isActive: boolean;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  incrementPlayCount(): Promise<ITrack>;
  duration: string; // Virtual field
  plays: string; // Virtual field
}

// Query helper types for Track
interface ITrackQueryHelpers {
  active(): QueryWithHelpers<ITrack[], ITrack, ITrackQueryHelpers>;
  free(): QueryWithHelpers<ITrack[], ITrack, ITrackQueryHelpers>;
  premium(): QueryWithHelpers<ITrack[], ITrack, ITrackQueryHelpers>;
  byCategory(categoryId: string): QueryWithHelpers<ITrack[], ITrack, ITrackQueryHelpers>;
  byLevel(level: string): QueryWithHelpers<ITrack[], ITrack, ITrackQueryHelpers>;
}

// Track model interface with statics
interface ITrackModel extends Model<ITrack, ITrackQueryHelpers> {
  findNotDeleted(conditions?: FilterQuery<ITrack>): Query<ITrack[], ITrack>;
  findPopular(limit?: number): Query<ITrack[], ITrack>;
  findRecent(limit?: number): Query<ITrack[], ITrack>;
}

// Track schema
const TrackSchema = new Schema<ITrack, ITrackModel, Record<string, never>, ITrackQueryHelpers>(
  {
    title: {
      type: String,
      required: [true, 'Track title is required'],
      trim: true,
      minlength: [2, 'Title must be at least 2 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    durationSeconds: {
      type: Number,
      required: [true, 'Track duration is required'],
      min: [1, 'Duration must be at least 1 second'],
    },
    level: {
      type: String,
      required: [true, 'Track level is required'],
      enum: {
        values: ['مبتدأ', 'متوسط', 'متقدم'],
        message: '{VALUE} is not a valid level',
      },
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
      index: true,
    },
    relaxationType: {
      type: String,
      enum: {
        values: ['استرخاء صباحي', 'استرخاء مسائي'],
        message: '{VALUE} is not a valid relaxation type',
      },
    },
    imageUrl: {
      type: String,
      required: [true, 'Track image URL is required'],
    },
    audioUrl: {
      type: String,
      required: [true, 'Track audio URL is required'],
    },
    audioKey: {
      type: String,
      // R2/S3 key for deletion
    },
    playCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isPremium: {
      type: Boolean,
      default: false,
      index: true,
    },
    contentAccess: {
      type: String,
      enum: {
        values: ['free', 'basic', 'premium'],
        message: '{VALUE} is not a valid content access type',
      },
      default: 'free',
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: false, // We're using the timestamps plugin
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Apply timestamps plugin
TrackSchema.plugin(timestampsPlugin);

// Indexes
// Note: category, isPremium, isActive indexes are automatically created via index: true in field definitions
TrackSchema.index({ level: 1 });
TrackSchema.index({ playCount: -1 }); // For popular tracks
TrackSchema.index({ createdAt: -1 }); // For recent tracks

// Text index for search with Arabic support
TrackSchema.index(
  { title: 'text', description: 'text' },
  {
    weights: { title: 10, description: 5 },
    name: 'TrackTextIndex',
    default_language: 'none', // Support all languages including Arabic
  }
);

// Compound indexes for common queries
TrackSchema.index({ category: 1, isActive: 1, isPremium: 1 });
TrackSchema.index({ category: 1, isActive: 1, contentAccess: 1 });
TrackSchema.index({ isActive: 1, playCount: -1 });

// Virtual field: duration formatted as "MM:SS د" (e.g., "20:00 د")
TrackSchema.virtual('duration').get(function () {
  const minutes = Math.floor(this.durationSeconds / 60);
  const seconds = this.durationSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')} د`;
});

// Virtual field: plays formatted (e.g., "12 الف", "500")
TrackSchema.virtual('plays').get(function () {
  const count = this.playCount || 0;
  if (count >= 1000) {
    const thousands = Math.floor(count / 1000);
    return `${thousands} الف`;
  }
  return count.toString();
});

// Method to increment play count
TrackSchema.methods.incrementPlayCount = async function (): Promise<ITrack> {
  this.playCount += 1;
  return this.save();
};

// Query helpers
TrackSchema.query.active = function (this: QueryWithHelpers<ITrack[], ITrack, ITrackQueryHelpers>) {
  return this.where({ isActive: true });
};

TrackSchema.query.free = function (this: QueryWithHelpers<ITrack[], ITrack, ITrackQueryHelpers>) {
  return this.where({ isPremium: false });
};

TrackSchema.query.premium = function (this: QueryWithHelpers<ITrack[], ITrack, ITrackQueryHelpers>) {
  return this.where({ isPremium: true });
};

TrackSchema.query.byCategory = function (this: QueryWithHelpers<ITrack[], ITrack, ITrackQueryHelpers>, categoryId: string) {
  return this.where({ category: categoryId });
};

TrackSchema.query.byLevel = function (this: QueryWithHelpers<ITrack[], ITrack, ITrackQueryHelpers>, level: string) {
  return this.where({ level });
};

// Static methods
TrackSchema.statics.findPopular = function (limit = 10) {
  return this.find({ isActive: true }).sort({ playCount: -1 }).limit(limit);
};

TrackSchema.statics.findRecent = function (limit = 10) {
  return this.find({ isActive: true }).sort({ createdAt: -1 }).limit(limit);
};

// Create and export the Track model
export const Track = model<ITrack, ITrackModel>('Track', TrackSchema);

export default Track;
