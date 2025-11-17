import { Request, Response } from 'express';
import { UserFavorite } from '../models/UserFavorite.model';
import { Track } from '../models/Track.model';
import { Program } from '../models/Program.model';
import logger from '../utils/logger';
import { successResponse, errorResponse } from '../utils/response';

/**
 * @desc    Get user's favorite tracks
 * @route   GET /api/v1/users/favorites/tracks
 * @access  Private
 */
export const getFavoriteTracks = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      errorResponse(res, 'User not authenticated', 401);
      return;
    }

    const favorites = await UserFavorite.find({
      userId,
      type: 'track',
    })
      .populate({
        path: 'trackId',
        match: { isActive: true },
        populate: {
          path: 'category',
          select: 'name nameAr emoji',
        },
      })
      .sort({ createdAt: -1 })
      .lean();

    const tracks = favorites
      .filter((fav) => fav.trackId)
      .map((fav) => ({
        ...(fav.trackId as Record<string, unknown>),
        isFavorite: true,
      }));

    successResponse(res, tracks, 'Favorite tracks retrieved successfully');
  } catch (error: unknown) {
    logger.error('Get favorite tracks error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to retrieve favorite tracks';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get user's favorite programs
 * @route   GET /api/v1/users/favorites/programs
 * @access  Private
 */
export const getFavoritePrograms = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      errorResponse(res, 'User not authenticated', 401);
      return;
    }

    const favorites = await UserFavorite.find({
      userId,
      type: 'program',
    })
      .populate({
        path: 'programId',
        match: { isActive: true },
        populate: {
          path: 'category',
          select: 'name nameAr emoji',
        },
      })
      .sort({ createdAt: -1 })
      .lean();

    const programs = favorites
      .filter((fav) => fav.programId)
      .map((fav) => ({
        ...(fav.programId as Record<string, unknown>),
        isFavorite: true,
      }));

    successResponse(res, programs, 'Favorite programs retrieved successfully');
  } catch (error: unknown) {
    logger.error('Get favorite programs error:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to retrieve favorite programs';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Add track to favorites
 * @route   POST /api/v1/users/favorites/tracks/:trackId
 * @access  Private
 */
export const addTrackToFavorites = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { trackId } = req.params;

    if (!userId) {
      errorResponse(res, 'User not authenticated', 401);
      return;
    }

    const track = await Track.findOne({ _id: trackId, isActive: true });

    if (!track) {
      errorResponse(res, 'Track not found', 404);
      return;
    }

    const existingFavorite = await UserFavorite.findOne({
      userId,
      trackId,
      type: 'track',
    });

    if (existingFavorite) {
      successResponse(res, null, 'Track is already in favorites');
      return;
    }

    await UserFavorite.create({
      userId,
      trackId,
      type: 'track',
    });

    successResponse(res, null, 'Track added to favorites successfully', 201);
  } catch (error: unknown) {
    logger.error('Add track to favorites error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to add track to favorites';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Remove track from favorites
 * @route   DELETE /api/v1/users/favorites/tracks/:trackId
 * @access  Private
 */
export const removeTrackFromFavorites = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { trackId } = req.params;

    if (!userId) {
      errorResponse(res, 'User not authenticated', 401);
      return;
    }

    await UserFavorite.deleteOne({
      userId,
      trackId,
      type: 'track',
    });

    successResponse(res, null, 'Track removed from favorites successfully');
  } catch (error: unknown) {
    logger.error('Remove track from favorites error:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to remove track from favorites';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Add program to favorites
 * @route   POST /api/v1/users/favorites/programs/:programId
 * @access  Private
 */
export const addProgramToFavorites = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { programId } = req.params;

    if (!userId) {
      errorResponse(res, 'User not authenticated', 401);
      return;
    }

    const program = await Program.findOne({ _id: programId, isActive: true });

    if (!program) {
      errorResponse(res, 'Program not found', 404);
      return;
    }

    const existingFavorite = await UserFavorite.findOne({
      userId,
      programId,
      type: 'program',
    });

    if (existingFavorite) {
      successResponse(res, null, 'Program is already in favorites');
      return;
    }

    await UserFavorite.create({
      userId,
      programId,
      type: 'program',
    });

    successResponse(res, null, 'Program added to favorites successfully', 201);
  } catch (error: unknown) {
    logger.error('Add program to favorites error:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to add program to favorites';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Remove program from favorites
 * @route   DELETE /api/v1/users/favorites/programs/:programId
 * @access  Private
 */
export const removeProgramFromFavorites = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { programId } = req.params;

    if (!userId) {
      errorResponse(res, 'User not authenticated', 401);
      return;
    }

    await UserFavorite.deleteOne({
      userId,
      programId,
      type: 'program',
    });

    successResponse(res, null, 'Program removed from favorites successfully');
  } catch (error: unknown) {
    logger.error('Remove program from favorites error:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to remove program from favorites';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get favorite counts for user
 * @route   GET /api/v1/users/favorites/count
 * @access  Private
 */
export const getFavoriteCounts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      errorResponse(res, 'User not authenticated', 401);
      return;
    }

    const [tracksCount, programsCount] = await Promise.all([
      UserFavorite.countDocuments({ userId, type: 'track' }),
      UserFavorite.countDocuments({ userId, type: 'program' }),
    ]);

    const counts = {
      tracks: tracksCount,
      programs: programsCount,
    };

    successResponse(res, counts, 'Favorite counts retrieved successfully');
  } catch (error: unknown) {
    logger.error('Get favorite counts error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to retrieve favorite counts';
    errorResponse(res, message, 500);
  }
};
