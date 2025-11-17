import { Request, Response } from 'express';
import { ListeningSession } from '../models/ListeningSession.model';
import { Track } from '../models/Track.model';
import { Program } from '../models/Program.model';
import { UserProgram } from '../models/UserProgram.model';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

/**
 * @desc    Start a new listening session
 * @route   POST /api/v1/users/listening-sessions
 * @access  Private
 */
export const startListeningSession = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { trackId, programId } = req.body;

    if (!userId) {
      errorResponse(res, 'User not authenticated', 401);
      return;
    }

    // Validate trackId exists
    const track = await Track.findOne({ _id: trackId, isActive: true });
    if (!track) {
      errorResponse(res, 'Track not found', 404);
      return;
    }

    // Validate programId if provided
    if (programId) {
      const program = await Program.findOne({ _id: programId, isActive: true });
      if (!program) {
        errorResponse(res, 'Program not found', 404);
        return;
      }
    }

    // Create listening session
    const session = await ListeningSession.create({
      userId,
      trackId,
      programId: programId || undefined,
      startTime: new Date(),
      endTime: undefined,
      completed: false,
      durationSeconds: 0,
      lastPosition: 0,
    });

    successResponse(
      res,
      { sessionId: session._id },
      'Listening session started successfully',
      201
    );
  } catch (error: unknown) {
    logger.error('Start listening session error:', error);
    const message = error instanceof Error ? error.message : 'Failed to start listening session';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Update listening session position
 * @route   PUT /api/v1/users/listening-sessions/:sessionId
 * @access  Private
 */
export const updateListeningSession = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { sessionId } = req.params;
    const { currentTime } = req.body;

    if (!userId) {
      errorResponse(res, 'User not authenticated', 401);
      return;
    }

    // Find session by id and userId
    const session = await ListeningSession.findOne({
      _id: sessionId,
      userId,
    });

    if (!session) {
      errorResponse(res, 'Listening session not found', 404);
      return;
    }

    // Update lastPosition
    session.lastPosition = currentTime;

    // Calculate duration in seconds
    const now = new Date();
    const startTime = new Date(session.startTime);
    session.durationSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);

    await session.save();

    successResponse(res, null, 'Listening session updated successfully');
  } catch (error: unknown) {
    logger.error('Update listening session error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update listening session';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    End listening session
 * @route   POST /api/v1/users/listening-sessions/:sessionId/end
 * @access  Private
 */
export const endListeningSession = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { sessionId } = req.params;
    const { completed } = req.body;

    if (!userId) {
      errorResponse(res, 'User not authenticated', 401);
      return;
    }

    // Find session by id and userId
    const session = await ListeningSession.findOne({
      _id: sessionId,
      userId,
    });

    if (!session) {
      errorResponse(res, 'Listening session not found', 404);
      return;
    }

    // Set endTime
    const now = new Date();
    session.endTime = now;
    session.completed = completed;

    // Calculate final duration
    const startTime = new Date(session.startTime);
    session.durationSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);

    await session.save();

    // If completed and has programId, update program progress
    if (completed && session.programId) {
      try {
        const userProgram = await UserProgram.findOne({
          userId,
          programId: session.programId,
        });

        if (userProgram) {
          // Mark track as completed in the program
          await userProgram.markTrackComplete(session.trackId.toString());
          logger.info(`Marked track ${session.trackId} as complete in program ${session.programId} for user ${userId}`);
        }
      } catch (programError) {
        logger.error('Failed to update program progress:', programError);
        // Don't fail the session end if program update fails
      }
    }

    successResponse(res, null, 'Listening session ended successfully');
  } catch (error: unknown) {
    logger.error('End listening session error:', error);
    const message = error instanceof Error ? error.message : 'Failed to end listening session';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get listening history
 * @route   GET /api/v1/users/history
 * @access  Private
 */
export const getListeningHistory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const {
      page = '1',
      limit = '20',
      startDate,
      endDate,
    } = req.query;

    if (!userId) {
      errorResponse(res, 'User not authenticated', 401);
      return;
    }

    // Build query
    const query: Record<string, unknown> = { userId };

    // Filter by date range if provided
    if (startDate || endDate) {
      const timeQuery: { $gte?: Date; $lte?: Date } = {};
      if (startDate) {
        timeQuery.$gte = new Date(startDate as string);
      }
      if (endDate) {
        timeQuery.$lte = new Date(endDate as string);
      }
      query.startTime = timeQuery;
    }

    // Pagination
    const limitNum = parseInt(limit as string);
    const pageNum = parseInt(page as string);
    const skip = (pageNum - 1) * limitNum;

    // Execute query
    const [sessions, total] = await Promise.all([
      ListeningSession.find(query)
        .populate('trackId', 'title description imageUrl durationSeconds level category')
        .populate('programId', 'title description imageUrl')
        .sort({ startTime: -1 })
        .skip(skip)
        .limit(limitNum),
      ListeningSession.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    successResponse(
      res,
      {
        sessions,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      },
      'Listening history retrieved successfully'
    );
  } catch (error: unknown) {
    logger.error('Get listening history error:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve listening history';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get recent tracks
 * @route   GET /api/v1/users/history/recent
 * @access  Private
 */
export const getRecentTracks = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { limit = '10' } = req.query;

    if (!userId) {
      errorResponse(res, 'User not authenticated', 401);
      return;
    }

    const limitNum = parseInt(limit as string);

    // Get recent listening sessions
    const sessions = await ListeningSession.find({ userId })
      .sort({ startTime: -1 })
      .limit(limitNum * 2) // Get more to filter duplicates
      .populate('trackId', 'title description imageUrl durationSeconds level category');

    // Get unique tracks (avoid duplicates)
    const seenTrackIds = new Set<string>();
    const uniqueTracks: unknown[] = [];

    for (const session of sessions) {
      const track = session.trackId as unknown;
      const trackObj = track as { _id?: { toString(): string } };

      if (trackObj && trackObj._id) {
        const trackId = trackObj._id.toString();

        if (!seenTrackIds.has(trackId)) {
          seenTrackIds.add(trackId);
          uniqueTracks.push(track);

          if (uniqueTracks.length >= limitNum) {
            break;
          }
        }
      }
    }

    successResponse(
      res,
      uniqueTracks,
      'Recent tracks retrieved successfully'
    );
  } catch (error: unknown) {
    logger.error('Get recent tracks error:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve recent tracks';
    errorResponse(res, message, 500);
  }
};

/**
 * @desc    Get listening statistics for a user
 * @route   GET /api/v1/users/listening-stats
 * @access  Private
 */
export const getListeningStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { period = 'week' } = req.query;

    if (!userId) {
      errorResponse(res, 'User not authenticated', 401);
      return;
    }

    // Calculate date range based on period
    let startDate = new Date();
    let groupByFormat: string;

    switch (period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        groupByFormat = '%Y-%m-%d';
        break;
      case 'month':
        startDate.setDate(startDate.getDate() - 30);
        groupByFormat = '%Y-%m-%d';
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        groupByFormat = '%Y-%U'; // Year-Week
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
        groupByFormat = '%Y-%m-%d';
    }

    // Aggregate listening data by date
    const stats = await ListeningSession.aggregate([
      {
        $match: {
          userId,
          startTime: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: groupByFormat,
              date: '$startTime',
            },
          },
          minutes: {
            $sum: { $divide: ['$durationSeconds', 60] },
          },
          sessions: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          minutes: { $round: ['$minutes', 1] },
          sessions: 1,
        },
      },
    ]);

    // Calculate total listening time
    const totalMinutes = stats.reduce((sum, stat) => sum + stat.minutes, 0);
    const totalSessions = stats.reduce((sum, stat) => sum + stat.sessions, 0);

    successResponse(
      res,
      {
        period,
        stats,
        summary: {
          totalMinutes: Math.round(totalMinutes),
          totalSessions,
          avgMinutesPerDay: stats.length > 0 ? Math.round(totalMinutes / stats.length) : 0,
        },
      },
      'Listening statistics retrieved successfully'
    );
  } catch (error: unknown) {
    logger.error('Get listening stats error:', error);
    const message = error instanceof Error ? error.message : 'Failed to retrieve listening statistics';
    errorResponse(res, message, 500);
  }
};
