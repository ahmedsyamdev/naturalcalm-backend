import { Request, Response } from 'express';
import { Track, ITrack } from '../models/Track.model';
import { Program, IProgram } from '../models/Program.model';
import { SearchLog } from '../models/SearchLog.model';
import { UserFavorite } from '../models/UserFavorite.model';
import { asyncHandler } from '../utils/asyncHandler';
import { cacheGet, cacheSet, cacheDelPattern } from '../config/redis';
import { executeSearch } from '../utils/atlasSearch';
import { FilterQuery } from 'mongoose';

type TrackWithFavorite = ITrack & { isFavorite: boolean };
type ProgramWithFavorite = IProgram & { isFavorite: boolean };

/**
 * @desc    Search tracks with filters
 * @route   GET /api/v1/search
 * @access  Public (optionalAuth)
 */
export const search = asyncHandler(async (req: Request, res: Response) => {
  const {
    q = '',
    type = 'all',
    category,
    level,
    relaxationType,
    minDuration,
    maxDuration,
    minSessions,
    maxSessions,
    isPremium,
    page = '1',
    limit = '20',
  } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = Math.min(parseInt(limit as string, 10), 100);
  const skip = (pageNum - 1) * limitNum;
  const query = String(q).trim();
  const userId = req.user?.id;

  // Generate cache key
  const cacheKey = `search:${type}:${query}:${JSON.stringify({
    category,
    level,
    relaxationType,
    minDuration,
    maxDuration,
    minSessions,
    maxSessions,
    isPremium,
  })}:${pageNum}:${limitNum}:${userId || 'guest'}`;

  // Check cache
  const cachedResult = await cacheGet(cacheKey);
  if (cachedResult) {
    return res.json(cachedResult);
  }

  let tracks: ITrack[] = [];
  let programs: IProgram[] = [];
  let tracksTotal = 0;
  let programsTotal = 0;

  // Search tracks if type is 'all' || type === 'track'
  if (type === 'all' || type === 'track') {
    const trackFilters: FilterQuery<ITrack> = { isActive: true };

    // Apply filters
    if (category) trackFilters.category = category;
    if (level) trackFilters.level = level;
    if (relaxationType) trackFilters.relaxationType = relaxationType;
    if (isPremium !== undefined) trackFilters.isPremium = isPremium === 'true';

    // Duration filters (convert minutes to seconds)
    if (minDuration !== undefined || maxDuration !== undefined) {
      trackFilters.durationSeconds = {};
      if (minDuration !== undefined) {
        trackFilters.durationSeconds.$gte = Number(minDuration) * 60;
      }
      if (maxDuration !== undefined) {
        trackFilters.durationSeconds.$lte = Number(maxDuration) * 60;
      }
    }

    // Execute search with Atlas Search or fallback to text search
    const searchResult = await executeSearch(Track, query, trackFilters, skip, limitNum);
    tracks = searchResult.results;
    tracksTotal = searchResult.total;

    // Add favorite status if user is authenticated
    if (userId && tracks.length > 0) {
      const trackIds = tracks.map((t) => String(t._id));
      const favorites = await UserFavorite.checkMultipleFavorites(userId, trackIds, 'track');
      tracks = tracks.map((track) => ({
        ...track,
        isFavorite: favorites[String(track._id)] || false,
      })) as TrackWithFavorite[];
    } else {
      tracks = tracks.map((track) => ({ ...track, isFavorite: false })) as TrackWithFavorite[];
    }
  }

  // Search programs if type is 'all' or 'program'
  if (type === 'all' || type === 'program') {
    const programFilters: FilterQuery<IProgram> = { isActive: true };

    // Apply filters
    if (category) programFilters.category = category;
    if (level) programFilters.level = level;
    if (isPremium !== undefined) programFilters.isPremium = isPremium === 'true';

    // Execute search with Atlas Search or fallback to text search
    const searchResult = await executeSearch(Program, query, programFilters, skip, limitNum);
    programs = searchResult.results;
    programsTotal = searchResult.total;

    // Filter by sessions count if needed (post-processing)
    if (minSessions !== undefined || maxSessions !== undefined) {
      programs = programs.filter((program) => {
        const sessionsCount = program.tracks?.length || 0;
        const min = minSessions ? Number(minSessions) : 0;
        const max = maxSessions ? Number(maxSessions) : Infinity;
        return sessionsCount >= min && sessionsCount <= max;
      });
      programsTotal = programs.length; // Update total after filtering
    }

    // Add favorite status if user is authenticated
    if (userId && programs.length > 0) {
      const programIds = programs.map((p) => String(p._id));
      const favorites = await UserFavorite.checkMultipleFavorites(userId, programIds, 'program');
      programs = programs.map((program) => ({
        ...program,
        isFavorite: favorites[String(program._id)] || false,
      })) as ProgramWithFavorite[];
    } else {
      programs = programs.map((program) => ({ ...program, isFavorite: false })) as ProgramWithFavorite[];
    }
  }

  // Calculate totals
  const total = tracksTotal + programsTotal;

  // Prepare response
  const response = {
    success: true,
    data: {
      tracks,
      programs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalTracks: tracksTotal,
        totalPrograms: programsTotal,
        total,
        pages: Math.ceil(total / limitNum),
      },
    },
  };

  // Log search for analytics (don't await, run in background)
  SearchLog.create({
    query,
    userId,
    type: type as 'all' | 'track' | 'program',
    filters: {
      category: category as string,
      level: level as string,
      relaxationType: relaxationType as string,
      minDuration: minDuration ? Number(minDuration) : undefined,
      maxDuration: maxDuration ? Number(maxDuration) : undefined,
      minSessions: minSessions ? Number(minSessions) : undefined,
      maxSessions: maxSessions ? Number(maxSessions) : undefined,
      isPremium: isPremium !== undefined ? isPremium === 'true' : undefined,
    },
    resultCount: total,
    tracksCount: tracksTotal,
    programsCount: programsTotal,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  }).catch((err) => console.error('Failed to log search:', err));

  // Cache for 5 minutes
  await cacheSet(cacheKey, response, 5 * 60);

  res.json(response);
});

/**
 * @desc    Get search suggestions
 * @route   GET /api/v1/search/suggestions
 * @access  Public
 */
export const getSearchSuggestions = asyncHandler(async (req: Request, res: Response) => {
  const { q } = req.query;
  const query = String(q).trim();
  const limit = 10;

  // Generate cache key
  const cacheKey = `search:suggestions:${query}`;

  // Check cache
  const cachedSuggestions = await cacheGet(cacheKey);
  if (cachedSuggestions) {
    return res.json(cachedSuggestions);
  }

  // Escape special regex characters
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Find tracks and programs where title starts with query
  const [trackSuggestions, programSuggestions] = await Promise.all([
    Track.find({
      isActive: true,
      title: { $regex: `^${escapedQuery}`, $options: 'i' },
    })
      .select('title')
      .limit(limit)
      .lean(),

    Program.find({
      isActive: true,
      title: { $regex: `^${escapedQuery}`, $options: 'i' },
    })
      .select('title')
      .limit(limit)
      .lean(),
  ]);

  // Combine and deduplicate suggestions
  const allTitles = [
    ...trackSuggestions.map((t) => t.title),
    ...programSuggestions.map((p) => p.title),
  ];

  // Remove duplicates and limit
  const uniqueTitles = Array.from(new Set(allTitles)).slice(0, limit);

  const response = {
    success: true,
    data: {
      suggestions: uniqueTitles,
    },
  };

  // Cache for 5 minutes
  await cacheSet(cacheKey, response, 5 * 60);

  res.json(response);
});

/**
 * @desc    Get popular searches
 * @route   GET /api/v1/search/popular
 * @access  Public
 */
export const getPopularSearches = asyncHandler(async (req: Request, res: Response) => {
  const { limit = '10', days = '7' } = req.query;
  const limitNum = Math.min(parseInt(limit as string, 10), 50);
  const daysNum = parseInt(days as string, 10);

  const cacheKey = `search:popular:${daysNum}:${limitNum}`;

  // Check cache
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  const popularSearches = await SearchLog.getPopularSearches(limitNum, daysNum);

  const response = {
    success: true,
    message: 'Popular searches retrieved successfully',
    data: popularSearches,
  };

  // Cache for 30 minutes
  await cacheSet(cacheKey, response, 30 * 60);

  res.json(response);
});

/**
 * @desc    Get searches with no results (for analytics/improvement)
 * @route   GET /api/v1/search/no-results
 * @access  Private/Admin
 */
export const getNoResultSearches = asyncHandler(async (req: Request, res: Response) => {
  const { limit = '20', days = '7' } = req.query;
  const limitNum = Math.min(parseInt(limit as string, 10), 100);
  const daysNum = parseInt(days as string, 10);

  const noResultSearches = await SearchLog.getNoResultSearches(limitNum, daysNum);

  res.json({
    success: true,
    message: 'No-result searches retrieved successfully',
    data: noResultSearches,
  });
});

/**
 * @desc    Clear search cache
 * @route   DELETE /api/v1/search/cache
 * @access  Private/Admin
 */
export const clearSearchCache = asyncHandler(async (req: Request, res: Response) => {
  await cacheDelPattern('search:*');
  res.json({
    success: true,
    message: 'Search cache cleared successfully',
  });
});
