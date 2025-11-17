import { Schema } from 'mongoose';
import { User } from '../../models/User.model';
import { Program } from '../../models/Program.model';
import { Track } from '../../models/Track.model';
import { Category } from '../../models/Category.model';
import { JWTUtil } from '../../utils/jwt';

/**
 * Create a test user
 */
export const createTestUser = async (role: string = 'user') => {
  const user = await User.create({
    name: 'Test User',
    phone: '+201234567890',
    role,
    isPhoneVerified: true,
  });

  const token = JWTUtil.generateAccessToken({
    id: user._id.toString(),
    phone: user.phone,
    role: user.role,
  });

  return { user, token };
};

/**
 * Create a test category
 */
export const createTestCategory = async () => {
  return await Category.create({
    name: 'التأمل',
    nameEn: 'Meditation',
    icon: '🧘',
    color: '#4091A5',
    imageUrl: 'https://example.com/meditation.jpg',
    displayOrder: 1,
    isActive: true,
  });
};

/**
 * Create a test track
 */
export const createTestTrack = async (categoryId: Schema.Types.ObjectId) => {
  return await Track.create({
    title: 'تأمل الصباح',
    titleEn: 'Morning Meditation',
    description: 'تأمل للصباح',
    category: categoryId,
    audioUrl: 'https://example.com/audio.mp3',
    imageUrl: 'https://example.com/image.jpg',
    durationSeconds: 600,
    level: 'مبتدأ',
    isPremium: false,
    isActive: true,
  });
};

/**
 * Create a test program with tracks
 */
export const createTestProgram = async (
  categoryId: Schema.Types.ObjectId,
  trackIds: Schema.Types.ObjectId[]
) => {
  return await Program.create({
    title: 'برنامج التأمل الصباحي',
    description: 'برنامج للتأمل الصباحي',
    level: 'مبتدأ',
    category: categoryId,
    thumbnailUrl: 'https://example.com/program.jpg',
    tracks: trackIds.map((trackId, index) => ({
      trackId,
      order: index + 1,
    })),
    isPremium: false,
    isFeatured: false,
    isActive: true,
  });
};

/**
 * Create multiple test tracks
 */
export const createMultipleTracks = async (
  categoryId: Schema.Types.ObjectId,
  count: number
) => {
  const tracks = [];
  for (let i = 0; i < count; i++) {
    const track = await Track.create({
      title: `Track ${i + 1}`,
      titleEn: `Track ${i + 1}`,
      description: `Test track ${i + 1}`,
      category: categoryId,
      audioUrl: `https://example.com/audio${i + 1}.mp3`,
      imageUrl: `https://example.com/image${i + 1}.jpg`,
      durationSeconds: 600,
      level: 'مبتدأ',
      isPremium: false,
      isActive: true,
    });
    tracks.push(track);
  }
  return tracks;
};
