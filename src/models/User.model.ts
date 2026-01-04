import { Schema, model, Model, Document, FilterQuery, Query } from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import timestampsPlugin from './plugins/timestamps';

// Subscription subdocument interface
interface ISubscription {
  packageId?: Schema.Types.ObjectId;
  status: 'active' | 'expired' | 'cancelled';
  startDate?: Date;
  endDate?: Date;
  autoRenew: boolean;
}

// Listening patterns interface
export interface IListeningPatterns {
  favoriteCategories: Array<{
    category: string;
    count: number;
  }>;
  peakListeningHours: Array<{
    hour: number;
    count: number;
  }>;
  averageSessionDuration: number;
  completionRate: number;
  lastUpdated?: Date;
}

// FCM Device interface
export interface IFCMDevice {
  token: string;
  platform: 'web' | 'android' | 'ios';
  browser?: string;
  addedAt: Date;
  lastUsedAt: Date;
}

// User preferences interface
interface IPreferences {
  categories?: Schema.Types.ObjectId[];
  notifications: {
    newContent: boolean;
    achievements: boolean;
    reminders: boolean;
    subscription: boolean;
  };
  reminderTime: number; // Hour of day (0-23) for daily reminders
  enableDailyReminder: boolean;
  listeningPatterns?: IListeningPatterns;
}

// Social provider interface
interface ISocialProvider {
  provider: 'google' | 'facebook' | 'apple';
  providerId: string;
  email?: string;
}

// User document interface
export interface IUser extends Document {
  name: string;
  phone?: string;
  email: string;
  password: string;
  avatar?: string;
  isVerified: boolean;
  otp?: string;
  otpExpires?: Date;
  role: 'user' | 'admin';
  subscription: ISubscription;
  preferences: IPreferences;
  fcmTokens: IFCMDevice[]; // Array of FCM device tokens
  lastNotificationSentAt?: Date; // For rate limiting
  socialProviders?: ISocialProvider[];
  isBanned: boolean;
  bannedUntil?: Date;
  banReason?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateJWT(): string;
  generateRefreshToken(): string;
}

// User model interface with statics
interface IUserModel extends Model<IUser> {
  findNotDeleted(conditions?: FilterQuery<IUser>): Query<IUser[], IUser>;
}

// Subscription subdocument schema
const SubscriptionSchema = new Schema<ISubscription>(
  {
    packageId: {
      type: Schema.Types.ObjectId,
      ref: 'Package',
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled'],
      default: 'expired',
    },
    startDate: Date,
    endDate: Date,
    autoRenew: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

// FCM Device subdocument schema
const FCMDeviceSchema = new Schema<IFCMDevice>(
  {
    token: {
      type: String,
      required: true,
    },
    platform: {
      type: String,
      enum: ['web', 'android', 'ios'],
      default: 'web',
    },
    browser: String,
    addedAt: {
      type: Date,
      default: Date.now,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// Preferences subdocument schema
const PreferencesSchema = new Schema<IPreferences>(
  {
    categories: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Category',
      },
    ],
    notifications: {
      newContent: {
        type: Boolean,
        default: true,
      },
      achievements: {
        type: Boolean,
        default: true,
      },
      reminders: {
        type: Boolean,
        default: true,
      },
      subscription: {
        type: Boolean,
        default: true,
      },
    },
    reminderTime: {
      type: Number,
      default: 8, // Default to 8 AM
      min: 0,
      max: 23,
    },
    enableDailyReminder: {
      type: Boolean,
      default: true,
    },
    listeningPatterns: {
      favoriteCategories: [
        {
          category: String,
          count: Number,
        },
      ],
      peakListeningHours: [
        {
          hour: Number,
          count: Number,
        },
      ],
      averageSessionDuration: {
        type: Number,
        default: 0,
      },
      completionRate: {
        type: Number,
        default: 0,
      },
      lastUpdated: Date,
    },
  },
  { _id: false }
);

// Social Provider subdocument schema
const SocialProviderSchema = new Schema<ISocialProvider>(
  {
    provider: {
      type: String,
      enum: ['google', 'facebook', 'apple'],
      required: true,
    },
    providerId: {
      type: String,
      required: true,
    },
    email: String,
  },
  { _id: false }
);

// User schema
const UserSchema = new Schema<IUser, IUserModel>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    phone: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      match: [/^[+]?[\d\s()-]+$/, 'Please enter a valid phone number'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    password: {
      type: String,
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    avatar: {
      type: String,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: String,
      select: false,
    },
    otpExpires: {
      type: Date,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    subscription: {
      type: SubscriptionSchema,
      default: () => ({
        status: 'expired',
        autoRenew: true,
      }),
    },
    preferences: {
      type: PreferencesSchema,
      default: () => ({
        notifications: {
          newContent: true,
          achievements: true,
          reminders: true,
          subscription: true,
        },
        reminderTime: 8,
        enableDailyReminder: true,
      }),
    },
    fcmTokens: {
      type: [FCMDeviceSchema],
      default: [],
    },
    lastNotificationSentAt: {
      type: Date,
    },
    socialProviders: [SocialProviderSchema],
    isBanned: {
      type: Boolean,
      default: false,
    },
    bannedUntil: {
      type: Date,
    },
    banReason: {
      type: String,
    },
  },
  {
    timestamps: false, // We're using the timestamps plugin
  }
);

// Apply timestamps plugin
UserSchema.plugin(timestampsPlugin);

// Note: phone and email indexes are automatically created via unique constraints in field definitions

// Create index for FCM tokens for efficient queries
UserSchema.index({ 'fcmTokens.token': 1 });

// Pre-save hook to hash password
UserSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password') || !this.password) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: unknown) {
    next(error as Error);
  }
});

// Method to compare password
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch {
    throw new Error('Password comparison failed');
  }
};

// Method to generate JWT access token
UserSchema.methods.generateJWT = function (): string {
  const payload = {
    id: this._id,
    email: this.email,
    role: this.role,
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRE || '1h',
  } as jwt.SignOptions);
};

// Method to generate refresh token
UserSchema.methods.generateRefreshToken = function (): string {
  const payload = {
    id: this._id,
  };

  return jwt.sign(payload, env.JWT_REFRESH_SECRET || env.JWT_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRE || '7d',
  } as jwt.SignOptions);
};

// Create and export the User model
export const User = model<IUser, IUserModel>('User', UserSchema);

export default User;
