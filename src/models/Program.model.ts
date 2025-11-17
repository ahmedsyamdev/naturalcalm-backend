import { Schema, model, Model, Document, FilterQuery, Query, QueryWithHelpers } from 'mongoose';
import timestampsPlugin from './plugins/timestamps';

// Track reference with order
interface IProgramTrack {
  trackId: Schema.Types.ObjectId;
  order: number;
}

// Program document interface
export interface IProgram extends Document {
  title: string;
  description?: string;
  level: 'مبتدأ' | 'متوسط' | 'متقدم';
  category: Schema.Types.ObjectId;
  thumbnailUrl: string;
  thumbnailImages?: string[];
  tracks: IProgramTrack[];
  playCount: number;
  isPremium: boolean; // Deprecated: Use contentAccess instead
  contentAccess: 'free' | 'basic' | 'premium';
  isFeatured: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  sessions: number; // Virtual field
  totalPlays: string; // Virtual field
}

// Query helper types for Program
interface IProgramQueryHelpers {
  active(): QueryWithHelpers<IProgram[], IProgram, IProgramQueryHelpers>;
  featured(): QueryWithHelpers<IProgram[], IProgram, IProgramQueryHelpers>;
  free(): QueryWithHelpers<IProgram[], IProgram, IProgramQueryHelpers>;
  premium(): QueryWithHelpers<IProgram[], IProgram, IProgramQueryHelpers>;
  byCategory(categoryId: string): QueryWithHelpers<IProgram[], IProgram, IProgramQueryHelpers>;
  byLevel(level: string): QueryWithHelpers<IProgram[], IProgram, IProgramQueryHelpers>;
}

// Program model interface with statics
interface IProgramModel extends Model<IProgram, IProgramQueryHelpers> {
  findNotDeleted(conditions?: FilterQuery<IProgram>): Query<IProgram[], IProgram>;
  findPopular(limit?: number): Query<IProgram[], IProgram>;
  findFeatured(): Query<IProgram[], IProgram>;
}

// Program track subdocument schema
const ProgramTrackSchema = new Schema<IProgramTrack>(
  {
    trackId: {
      type: Schema.Types.ObjectId,
      ref: 'Track',
      required: true,
    },
    order: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: false }
);

// Program schema
const ProgramSchema = new Schema<IProgram, IProgramModel, Record<string, never>, IProgramQueryHelpers>(
  {
    title: {
      type: String,
      required: [true, 'Program title is required'],
      trim: true,
      minlength: [2, 'Title must be at least 2 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    level: {
      type: String,
      required: [true, 'Program level is required'],
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
    thumbnailUrl: {
      type: String,
      required: [true, 'Program thumbnail URL is required'],
    },
    thumbnailImages: {
      type: [String],
      default: [],
      validate: {
        validator: function (v: string[]) {
          return v.length <= 4;
        },
        message: 'Cannot have more than 4 thumbnail images',
      },
    },
    tracks: {
      type: [ProgramTrackSchema],
      default: [],
      validate: {
        validator: function (v: IProgramTrack[]) {
          // Check for unique track IDs
          // Filter out null/undefined trackIds before checking duplicates
          const trackIds = v
            .filter((t) => t && t.trackId)
            .map((t) => String(t.trackId));
          return trackIds.length === new Set(trackIds).size;
        },
        message: 'Duplicate tracks are not allowed in a program',
      },
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
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: false, // We're using the timestamps plugin
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Apply timestamps plugin
ProgramSchema.plugin(timestampsPlugin);

// Indexes
// Note: category, isPremium, isFeatured, isActive indexes are automatically created via index: true in field definitions
ProgramSchema.index({ level: 1 });
ProgramSchema.index({ playCount: -1 }); // For popular programs
ProgramSchema.index({ createdAt: -1 }); // For recent programs

// Text index for search with Arabic support
ProgramSchema.index(
  { title: 'text', description: 'text' },
  {
    weights: { title: 10, description: 5 },
    name: 'ProgramTextIndex',
    default_language: 'none', // Support all languages including Arabic
  }
);

// Compound indexes for common queries
ProgramSchema.index({ category: 1, isActive: 1, isPremium: 1 });
ProgramSchema.index({ category: 1, isActive: 1, contentAccess: 1 });
ProgramSchema.index({ isActive: 1, isFeatured: 1 });
ProgramSchema.index({ isActive: 1, playCount: -1 });

// Virtual field: sessions (track count)
ProgramSchema.virtual('sessions').get(function () {
  return this.tracks.length;
});

// Virtual field: totalPlays formatted (e.g., "12 الف", "500")
ProgramSchema.virtual('totalPlays').get(function () {
  if (this.playCount >= 1000) {
    const thousands = Math.floor(this.playCount / 1000);
    return `${thousands} الف`;
  }
  return this.playCount.toString();
});

// Method to increment play count
ProgramSchema.methods.incrementPlayCount = async function (): Promise<IProgram> {
  this.playCount += 1;
  return this.save();
};

// Query helpers
ProgramSchema.query.active = function (this: QueryWithHelpers<IProgram[], IProgram, IProgramQueryHelpers>) {
  return this.where({ isActive: true });
};

ProgramSchema.query.featured = function (this: QueryWithHelpers<IProgram[], IProgram, IProgramQueryHelpers>) {
  return this.where({ isFeatured: true, isActive: true });
};

ProgramSchema.query.free = function (this: QueryWithHelpers<IProgram[], IProgram, IProgramQueryHelpers>) {
  return this.where({ isPremium: false });
};

ProgramSchema.query.premium = function (this: QueryWithHelpers<IProgram[], IProgram, IProgramQueryHelpers>) {
  return this.where({ isPremium: true });
};

ProgramSchema.query.byCategory = function (this: QueryWithHelpers<IProgram[], IProgram, IProgramQueryHelpers>, categoryId: string) {
  return this.where({ category: categoryId });
};

ProgramSchema.query.byLevel = function (this: QueryWithHelpers<IProgram[], IProgram, IProgramQueryHelpers>, level: string) {
  return this.where({ level });
};

// Static methods
ProgramSchema.statics.findPopular = function (limit = 10) {
  return this.find({ isActive: true }).sort({ playCount: -1 }).limit(limit);
};

ProgramSchema.statics.findFeatured = function (limit = 10) {
  return this.find({ isActive: true, isFeatured: true })
    .sort({ playCount: -1 })
    .limit(limit);
};

ProgramSchema.statics.findRecent = function (limit = 10) {
  return this.find({ isActive: true }).sort({ createdAt: -1 }).limit(limit);
};

// Create and export the Program model
export const Program = model<IProgram, IProgramModel>('Program', ProgramSchema);

export default Program;
