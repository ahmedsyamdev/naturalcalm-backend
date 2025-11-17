import { Schema, model, Model, Document, FilterQuery, Query, QueryWithHelpers } from 'mongoose';
import timestampsPlugin from './plugins/timestamps';
import { ITrack } from './Track.model';

// Track reference with order
interface ICustomProgramTrack {
  trackId: Schema.Types.ObjectId;
  order: number;
}

// CustomProgram document interface
export interface ICustomProgram extends Document {
  userId: Schema.Types.ObjectId;
  name: string;
  description?: string;
  tracks: ICustomProgramTrack[];
  thumbnailUrl?: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  trackCount: number; // Virtual field
}

// Query helper types for CustomProgram
interface ICustomProgramQueryHelpers {
  byUser(userId: string): QueryWithHelpers<ICustomProgram[], ICustomProgram, ICustomProgramQueryHelpers>;
  public(): QueryWithHelpers<ICustomProgram[], ICustomProgram, ICustomProgramQueryHelpers>;
  private(): QueryWithHelpers<ICustomProgram[], ICustomProgram, ICustomProgramQueryHelpers>;
}

// CustomProgram model interface with statics
interface ICustomProgramModel extends Model<ICustomProgram, ICustomProgramQueryHelpers> {
  findNotDeleted(conditions?: FilterQuery<ICustomProgram>): Query<ICustomProgram[], ICustomProgram>;
}

// Custom program track subdocument schema
const CustomProgramTrackSchema = new Schema<ICustomProgramTrack>(
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

// CustomProgram schema
const CustomProgramSchema = new Schema<ICustomProgram, ICustomProgramModel, Record<string, never>, ICustomProgramQueryHelpers>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Custom program name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    tracks: {
      type: [CustomProgramTrackSchema],
      default: [],
      validate: {
        validator: function (v: ICustomProgramTrack[]) {
          // Check for unique track IDs
          // Filter out null/undefined trackIds before checking duplicates
          const trackIds = v
            .filter((t) => t && t.trackId)
            .map((t) => String(t.trackId));
          return trackIds.length === new Set(trackIds).size;
        },
        message: 'Duplicate tracks are not allowed in a custom program',
      },
    },
    thumbnailUrl: {
      type: String,
      // Can be set to the first track's image or a default image
    },
    isPublic: {
      type: Boolean,
      default: false,
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
CustomProgramSchema.plugin(timestampsPlugin);

// Indexes
// Note: userId index is automatically created via index: true in field definition
// Note: isPublic index is automatically created via index: true in field definition
CustomProgramSchema.index({ userId: 1, isPublic: 1 });
CustomProgramSchema.index({ createdAt: -1 });

// Virtual field: trackCount
CustomProgramSchema.virtual('trackCount').get(function () {
  return this.tracks.length;
});

// Pre-save hook to set thumbnail from first track if not provided
CustomProgramSchema.pre('save', async function (next) {
  if (!this.thumbnailUrl && this.tracks.length > 0) {
    try {
      // Get the first track's image
      const Track = model<ITrack>('Track');
      const firstTrack = await Track.findById(this.tracks[0].trackId).select(
        'imageUrl'
      );

      if (firstTrack?.imageUrl) {
        this.thumbnailUrl = firstTrack.imageUrl;
      }
    } catch {
      // If we can't get the track, just proceed without thumbnail
    }
  }
  next();
});

// Query helpers
CustomProgramSchema.query.byUser = function (this: QueryWithHelpers<ICustomProgram[], ICustomProgram, ICustomProgramQueryHelpers>, userId: string) {
  return this.where({ userId });
};

CustomProgramSchema.query.public = function (this: QueryWithHelpers<ICustomProgram[], ICustomProgram, ICustomProgramQueryHelpers>) {
  return this.where({ isPublic: true });
};

CustomProgramSchema.query.private = function (this: QueryWithHelpers<ICustomProgram[], ICustomProgram, ICustomProgramQueryHelpers>) {
  return this.where({ isPublic: false });
};

// Static methods
CustomProgramSchema.statics.findUserPrograms = function (userId: string) {
  return this.find({ userId }).sort({ createdAt: -1 });
};

CustomProgramSchema.statics.findPublicPrograms = function (limit = 20) {
  return this.find({ isPublic: true })
    .populate('userId', 'name avatar')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Create and export the CustomProgram model
export const CustomProgram = model<ICustomProgram, ICustomProgramModel>(
  'CustomProgram',
  CustomProgramSchema
);

export default CustomProgram;
