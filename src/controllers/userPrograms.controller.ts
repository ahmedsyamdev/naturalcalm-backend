import { Request, Response } from 'express';
import { UserProgram } from '../models/UserProgram.model';
import { CustomProgram } from '../models/CustomProgram.model';
import { Program, IProgram } from '../models/Program.model';
import { Track } from '../models/Track.model';
import logger from '../utils/logger';
import { successResponse, errorResponse } from '../utils/response';
import { Schema } from 'mongoose';
import { createNotification } from '../services/notification.service';
import { getNotificationTemplate, NOTIFICATION_TEMPLATES } from '../utils/notificationTemplates';

/**
 * @desc    Enroll user in a program
 * @route   POST /api/v1/users/programs/:programId/enroll
 * @access  Private
 */
export const enrollInProgram = async (req: Request, res: Response): Promise<void> => {
  try {
    const { programId } = req.params;
    const userId = req.user!.id;

    // Validate program exists
    const program = await Program.findOne({ _id: programId, isActive: true });
    if (!program) {
      errorResponse(res, 'Program not found', 404);
      return;
    }

    // Check if user already enrolled
    let userProgram = await UserProgram.findOne({ userId, programId });

    if (userProgram) {
      // Return existing enrollment
      await userProgram.populate('programId');
      successResponse(res, userProgram, 'Already enrolled in this program');
      return;
    }

    // Create new enrollment
    userProgram = await UserProgram.create({
      userId,
      programId,
      completedTracks: [],
      progress: 0,
      enrolledAt: new Date(),
    });

    await userProgram.populate('programId');

    successResponse(res, userProgram, 'Successfully enrolled in program', 201);
  } catch (error: unknown) {
    logger.error('Enroll in program error:', error);
    const message = error instanceof Error ? error.message : 'Failed to enroll in program';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get user's enrolled programs
 * @route   GET /api/v1/users/programs
 * @access  Private
 */
export const getEnrolledPrograms = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const enrollments = await UserProgram.find({ userId })
      .populate({
        path: 'programId',
        populate: [
          { path: 'category', select: 'name nameEn icon color imageUrl' },
          { path: 'tracks.trackId', select: 'title imageUrl durationSeconds' },
        ],
      })
      .sort({ lastAccessedAt: -1, enrolledAt: -1 });

    // Format response with progress details merged into program object
    const formattedEnrollments = enrollments.map((enrollment) => {
      const program = enrollment.programId as unknown as IProgram;
      const totalTracks = program?.tracks?.length || 0;
      const completedTracksCount = enrollment.completedTracks.length;

      return {
        ...program.toObject(),
        progress: enrollment.progress,
        completedSessions: completedTracksCount,
        sessions: totalTracks,
        enrolledAt: enrollment.enrolledAt,
        lastAccessedAt: enrollment.lastAccessedAt,
        isCompleted: enrollment.isCompleted,
        completedAt: enrollment.completedAt,
      };
    });

    successResponse(res, formattedEnrollments, 'Enrolled programs retrieved successfully');
  } catch (error: unknown) {
    logger.error('Get enrolled programs error:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve enrolled programs';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get user's progress for a specific program
 * @route   GET /api/v1/users/programs/:programId/progress
 * @access  Private
 */
export const getProgramProgress = async (req: Request, res: Response): Promise<void> => {
  try {
    const { programId } = req.params;
    const userId = req.user!.id;

    const userProgram = await UserProgram.findOne({ userId, programId })
      .populate('programId');

    if (!userProgram) {
      errorResponse(res, 'Not enrolled in this program', 404);
      return;
    }

    const program = userProgram.programId as unknown as IProgram;
    const totalTracks = program?.tracks?.length || 0;

    const progressData = {
      completedTracks: userProgram.completedTracks,
      progress: userProgram.progress,
      enrolledAt: userProgram.enrolledAt,
      lastAccessedAt: userProgram.lastAccessedAt,
      isCompleted: userProgram.isCompleted,
      completedAt: userProgram.completedAt,
      totalTracksCount: totalTracks,
      completedTracksCount: userProgram.completedTracks.length,
    };

    successResponse(res, progressData, 'Program progress retrieved successfully');
  } catch (error: unknown) {
    logger.error('Get program progress error:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve program progress';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Mark a track as complete in a program
 * @route   POST /api/v1/users/programs/:programId/tracks/:trackId/complete
 * @access  Private
 */
export const markTrackComplete = async (req: Request, res: Response): Promise<void> => {
  try {
    const { programId, trackId } = req.params;
    const userId = req.user!.id;

    // Find user's program enrollment
    const userProgram = await UserProgram.findOne({ userId, programId });

    if (!userProgram) {
      errorResponse(res, 'Not enrolled in this program', 404);
      return;
    }

    // Validate program and get tracks
    const program = await Program.findOne({ _id: programId, isActive: true });

    if (!program) {
      errorResponse(res, 'Program not found', 404);
      return;
    }

    // Validate trackId is part of the program
    const isTrackInProgram = program.tracks.some(
      (t) => t.trackId && String(t.trackId) === trackId
    );

    if (!isTrackInProgram) {
      errorResponse(res, 'Track is not part of this program', 400);
      return;
    }

    // Mark track as complete (this method handles duplicates)
    await userProgram.markTrackComplete(trackId);

    // Check if program is now completed and send notification
    if (userProgram.isCompleted && userProgram.completedAt) {
      // Send achievement notification
      try {
        const notificationData = getNotificationTemplate(
          NOTIFICATION_TEMPLATES.PROGRAM_COMPLETED,
          {
            programName: program.title,
            programNameAr: program.title,
          }
        );

        if (notificationData) {
          await createNotification(userId, notificationData);
        }
      } catch (notifError) {
        logger.error('Failed to create achievement notification:', notifError);
      }
    }

    const progressData = {
      completedTracks: userProgram.completedTracks,
      progress: userProgram.progress,
      isCompleted: userProgram.isCompleted,
      completedAt: userProgram.completedAt,
      lastAccessedAt: userProgram.lastAccessedAt,
    };

    successResponse(res, progressData, 'Track marked as complete');
  } catch (error: unknown) {
    logger.error('Mark track complete error:', error);
    const message = error instanceof Error ? error.message : 'Failed to mark track as complete';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get user's custom programs
 * @route   GET /api/v1/users/programs/custom
 * @access  Private
 */
export const getCustomPrograms = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const customPrograms = await CustomProgram.find({ userId })
      .sort({ createdAt: -1 });

    // Populate track details
    const populatedPrograms = await Promise.all(
      customPrograms.map(async (program) => {
        const trackIds = program.tracks
          .filter((t) => t && t.trackId) // Filter out null/undefined trackIds
          .map((t) => t.trackId);
        const tracks = await Track.find({ _id: { $in: trackIds }, isActive: true })
          .select('title imageUrl durationSeconds level isPremium');

        // Map tracks with their order
        const tracksWithOrder = program.tracks
          .filter((programTrack) => programTrack.trackId) // Filter out null/undefined trackIds
          .map((programTrack) => {
            const track = tracks.find(
              (t) => String(t._id) === String(programTrack.trackId)
            );
            return track ? {
              ...track.toObject(),
              order: programTrack.order,
            } : null;
          })
          .filter(Boolean);

        return {
          ...program.toObject(),
          tracks: tracksWithOrder,
        };
      })
    );

    successResponse(res, populatedPrograms, 'Custom programs retrieved successfully');
  } catch (error: unknown) {
    logger.error('Get custom programs error:', error);
    if (error instanceof Error && error.stack) {
      logger.error('Stack trace:', error.stack);
    }
    const message = error instanceof Error ? error.message : 'Failed to retrieve custom programs';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Create a custom program
 * @route   POST /api/v1/users/programs/custom
 * @access  Private
 */
export const createCustomProgram = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, trackIds } = req.body;
    const userId = req.user!.id;

    // Validate all track IDs exist
    const existingTracks = await Track.find({ _id: { $in: trackIds }, isActive: true });

    if (existingTracks.length !== trackIds.length) {
      errorResponse(res, 'One or more track IDs are invalid or inactive', 400);
      return;
    }

    // Build tracks array with order
    // Note: Mongoose automatically converts string IDs to ObjectIds, no need to wrap
    const tracks = trackIds.map((trackId: any, index: number) => ({
      trackId, // Mongoose handles the conversion
      order: index + 1,
    }));

    // Create custom program
    const customProgram = await CustomProgram.create({
      userId,
      name,
      description,
      tracks,
    });

    // Get the first track's image for thumbnail
    if (existingTracks.length > 0 && existingTracks[0].imageUrl) {
      customProgram.thumbnailUrl = existingTracks[0].imageUrl;
      await customProgram.save();
    }

    // Populate tracks with full details
    const trackDetails = existingTracks.map((track, index) => ({
      ...track.toObject(),
      order: index + 1,
    }));

    const response = {
      ...customProgram.toObject(),
      tracks: trackDetails,
    };

    successResponse(res, response, 'Custom program created successfully', 201);
  } catch (error: unknown) {
    logger.error('Create custom program error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create custom program';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Update a custom program
 * @route   PUT /api/v1/users/programs/custom/:id
 * @access  Private
 */
export const updateCustomProgram = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, trackIds } = req.body;
    const userId = req.user!.id;

    // Find custom program and verify ownership
    const customProgram = await CustomProgram.findOne({ _id: id, userId });

    if (!customProgram) {
      errorResponse(res, 'Custom program not found or you do not have permission', 404);
      return;
    }

    // Update fields
    if (name !== undefined) {
      customProgram.name = name;
    }

    if (description !== undefined) {
      customProgram.description = description;
    }

    // Update tracks if provided
    if (trackIds !== undefined) {
      // Validate all track IDs exist
      const existingTracks = await Track.find({ _id: { $in: trackIds }, isActive: true });

      if (existingTracks.length !== trackIds.length) {
        errorResponse(res, 'One or more track IDs are invalid or inactive', 400);
        return;
      }

      // Build tracks array with order
      // Note: Mongoose automatically converts string IDs to ObjectIds, no need to wrap
      const tracks = trackIds.map((trackId: any, index: number) => ({
        trackId, // Mongoose handles the conversion
        order: index + 1,
      }));

      customProgram.tracks = tracks;

      // Update thumbnail if tracks changed
      if (existingTracks.length > 0 && existingTracks[0].imageUrl) {
        customProgram.thumbnailUrl = existingTracks[0].imageUrl;
      }
    }

    await customProgram.save();

    // Get track details for response
    const trackIds_final = customProgram.tracks
      .filter((t) => t && t.trackId) // Filter out null/undefined trackIds
      .map((t) => t.trackId);
    const trackDetails = await Track.find({ _id: { $in: trackIds_final }, isActive: true })
      .select('title imageUrl durationSeconds level isPremium');

    const tracksWithOrder = customProgram.tracks
      .filter((programTrack) => programTrack.trackId) // Filter out null/undefined trackIds
      .map((programTrack) => {
        const track = trackDetails.find(
          (t) => String(t._id) === String(programTrack.trackId)
        );
        return track ? {
          ...track.toObject(),
          order: programTrack.order,
        } : null;
      })
      .filter(Boolean);

    const response = {
      ...customProgram.toObject(),
      tracks: tracksWithOrder,
    };

    successResponse(res, response, 'Custom program updated successfully');
  } catch (error: unknown) {
    logger.error('Update custom program error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update custom program';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Delete a custom program
 * @route   DELETE /api/v1/users/programs/custom/:id
 * @access  Private
 */
export const deleteCustomProgram = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Find custom program and verify ownership
    const customProgram = await CustomProgram.findOne({ _id: id, userId });

    if (!customProgram) {
      errorResponse(res, 'Custom program not found or you do not have permission', 404);
      return;
    }

    await CustomProgram.deleteOne({ _id: id });

    successResponse(res, null, 'Custom program deleted successfully');
  } catch (error: unknown) {
    logger.error('Delete custom program error:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete custom program';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get a custom program by ID
 * @route   GET /api/v1/users/programs/custom/:id
 * @access  Private
 */
export const getCustomProgramById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Find custom program and verify ownership
    const customProgram = await CustomProgram.findOne({ _id: id, userId });

    if (!customProgram) {
      errorResponse(res, 'Custom program not found or you do not have permission', 404);
      return;
    }

    // Populate track details
    const trackIds = customProgram.tracks
      .filter((t) => t && t.trackId) // Filter out null/undefined trackIds
      .map((t) => t.trackId);
    const tracks = await Track.find({ _id: { $in: trackIds }, isActive: true })
      .select('title imageUrl durationSeconds level isPremium');

    const tracksWithOrder = customProgram.tracks
      .filter((programTrack) => programTrack.trackId) // Filter out null/undefined trackIds
      .map((programTrack) => {
        const track = tracks.find(
          (t) => String(t._id) === String(programTrack.trackId)
        );
        return track ? {
          ...track.toObject(),
          order: programTrack.order,
        } : null;
      })
      .filter(Boolean);

    const response = {
      ...customProgram.toObject(),
      tracks: tracksWithOrder,
    };

    successResponse(res, response, 'Custom program retrieved successfully');
  } catch (error: unknown) {
    logger.error('Get custom program by ID error:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve custom program';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Unenroll from a program
 * @route   DELETE /api/v1/users/programs/:programId/enroll
 * @access  Private
 */
export const unenrollFromProgram = async (req: Request, res: Response): Promise<void> => {
  try {
    const { programId } = req.params;
    const userId = req.user!.id;

    const result = await UserProgram.deleteOne({ userId, programId });

    if (result.deletedCount === 0) {
      errorResponse(res, 'Enrollment not found', 404);
      return;
    }

    successResponse(res, null, 'Successfully unenrolled from program');
  } catch (error: unknown) {
    logger.error('Unenroll from program error:', error);
    const message = error instanceof Error ? error.message : 'Failed to unenroll from program';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get program leaderboard
 * @route   GET /api/v1/programs/:programId/leaderboard
 * @access  Public
 */
export const getProgramLeaderboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { programId } = req.params;

    // Validate program exists
    const program = await Program.findOne({ _id: programId, isActive: true });

    if (!program) {
      errorResponse(res, 'Program not found', 404);
      return;
    }

    // Get top 10 users who completed the program
    const leaderboard = await UserProgram.find({
      programId,
      isCompleted: true,
    })
      .populate('userId', 'name avatar')
      .sort({ completedAt: 1 })
      .limit(10);

    const formattedLeaderboard = leaderboard.map((entry, index) => ({
      rank: index + 1,
      user: entry.userId,
      completedAt: entry.completedAt,
      enrolledAt: entry.enrolledAt,
    }));

    successResponse(res, formattedLeaderboard, 'Leaderboard retrieved successfully');
  } catch (error: unknown) {
    logger.error('Get program leaderboard error:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve leaderboard';
    errorResponse(res, message, 500);
  }
};
