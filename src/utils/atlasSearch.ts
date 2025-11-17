// Complex generic types with Mongoose - using ts-nocheck for type compatibility
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { Model, FilterQuery, Document } from 'mongoose';
import logger from './logger';

// Atlas Search pipeline stage type
interface SearchStage {
  $search: {
    index: string;
    compound?: {
      must?: unknown[];
      filter?: unknown[];
    };
    text?: {
      query: string;
      path: string[];
      fuzzy?: {
        maxEdits: number;
        prefixLength: number;
      };
    };
  };
}

type PipelineStage = SearchStage | Record<string, unknown>;

// Flag to check if Atlas Search is available
let atlasSearchAvailable: boolean | null = null;

/**
 * Detect if MongoDB Atlas Search is available
 * This checks if we're connected to Atlas and if search indexes exist
 */
export async function isAtlasSearchAvailable<T extends Document>(model: Model<T>): Promise<boolean> {
  // Cache the result to avoid repeated checks
  if (atlasSearchAvailable !== null) {
    return atlasSearchAvailable;
  }

  try {
    // Check if we're connected to Atlas by looking at the connection string
    const connectionString = process.env.MONGODB_URI || '';
    const isAtlas = connectionString.includes('mongodb.net') || connectionString.includes('mongodb+srv');

    if (!isAtlas) {
      logger.info('Not connected to MongoDB Atlas - using fallback text search');
      atlasSearchAvailable = false;
      return false;
    }

    // Try to execute a simple Atlas Search query to verify it's available
    await model.aggregate([
      {
        $search: {
          index: model.collection.name === 'tracks' ? 'tracks_search' : 'programs_search',
          text: {
            query: 'test',
            path: ['title', 'description'],
          },
        },
      },
      { $limit: 1 },
    ]);

    atlasSearchAvailable = true;
    logger.info('MongoDB Atlas Search is available and configured');
    return true;
  } catch (error) {
    logger.warn('Atlas Search not available, falling back to basic text search:', error);
    atlasSearchAvailable = false;
    return false;
  }
}

/**
 * Build Atlas Search aggregation pipeline
 * This creates a $search stage with proper Arabic support
 */
export function buildAtlasSearchPipeline<T extends Document>(
  model: Model<T>,
  query: string,
  filters: FilterQuery<T>,
  skip: number,
  limit: number
): PipelineStage[] {
  const indexName = model.collection.name === 'tracks' ? 'tracks_search' : 'programs_search';

  const pipeline: PipelineStage[] = [];

  // 1. Atlas Search stage
  const searchStage: SearchStage = {
    $search: {
      index: indexName,
      compound: {
        must: [],
        filter: [],
      },
    },
  };

  // Add text search
  if (query && query.trim()) {
    searchStage.$search.compound.must.push({
      text: {
        query: query.trim(),
        path: ['title', 'description'],
        fuzzy: {
          maxEdits: 1, // Allow 1 character difference for typo tolerance
          prefixLength: 2, // First 2 chars must match exactly
        },
      },
    });
  }

  // Add filters
  if (filters.isActive !== undefined) {
    searchStage.$search.compound.filter.push({
      equals: {
        path: 'isActive',
        value: filters.isActive,
      },
    });
  }

  if (filters.isPremium !== undefined) {
    searchStage.$search.compound.filter.push({
      equals: {
        path: 'isPremium',
        value: filters.isPremium,
      },
    });
  }

  if (filters.level) {
    searchStage.$search.compound.filter.push({
      text: {
        query: filters.level,
        path: 'level',
      },
    });
  }

  if (filters.relaxationType) {
    searchStage.$search.compound.filter.push({
      text: {
        query: filters.relaxationType,
        path: 'relaxationType',
      },
    });
  }

  if (filters.category) {
    searchStage.$search.compound.filter.push({
      equals: {
        path: 'category',
        value: filters.category,
      },
    });
  }

  // Duration range for tracks
  if (filters.durationSeconds) {
    const rangeFilter: Record<string, unknown> = {
      range: {
        path: 'durationSeconds',
      },
    };

    if (filters.durationSeconds.$gte !== undefined) {
      rangeFilter.range.gte = filters.durationSeconds.$gte;
    }
    if (filters.durationSeconds.$lte !== undefined) {
      rangeFilter.range.lte = filters.durationSeconds.$lte;
    }

    searchStage.$search.compound.filter.push(rangeFilter);
  }

  pipeline.push(searchStage);

  // 2. Add search score
  pipeline.push({
    $addFields: {
      score: { $meta: 'searchScore' },
    },
  });

  // 3. Skip and limit
  if (skip > 0) {
    pipeline.push({ $skip: skip });
  }
  pipeline.push({ $limit: limit });

  return pipeline;
}

/**
 * Execute search with automatic fallback
 * Uses Atlas Search if available, otherwise falls back to $text
 */
export async function executeSearch<T>(
  model: Model<T>,
  query: string,
  filters: FilterQuery<T>,
  skip: number,
  limit: number
): Promise<{ results: T[]; total: number; usedAtlasSearch: boolean }> {
  const useAtlasSearch = await isAtlasSearchAvailable(model);

  if (useAtlasSearch) {
    // Use Atlas Search
    logger.info('Using Atlas Search for query:', query);

    try {
      const pipeline = buildAtlasSearchPipeline(model, query, filters, skip, limit);

      // Execute search
      const results = await model.aggregate(pipeline);

      // Get total count with same filters but no skip/limit
      const countPipeline = buildAtlasSearchPipeline(model, query, filters, 0, 10000);
      countPipeline.push({ $count: 'total' });
      const countResult = await model.aggregate(countPipeline);
      const total = countResult[0]?.total || 0;

      return {
        results: results as T[],
        total,
        usedAtlasSearch: true,
      };
    } catch (error) {
      logger.error('Atlas Search failed, falling back to text search:', error);
      // Fall through to basic text search
    }
  }

  // Fallback to basic text search
  logger.info('Using basic text search for query:', query);

  const searchFilters: FilterQuery<T> = { ...filters };
  if (query && query.trim()) {
    searchFilters.$text = { $search: query };
  }

  const projection = query ? { score: { $meta: 'textScore' } } : {};

  const searchQuery = model.find(searchFilters, projection).skip(skip).limit(limit);

  if (query) {
    searchQuery.sort({ score: { $meta: 'textScore' } });
  } else {
    searchQuery.sort({ playCount: -1, createdAt: -1 });
  }

  const [results, total] = await Promise.all([
    searchQuery.lean(),
    model.countDocuments(searchFilters),
  ]);

  return {
    results: results as T[],
    total,
    usedAtlasSearch: false,
  };
}

/**
 * Reset Atlas Search availability cache
 * Call this if you migrate from local to Atlas
 */
export function resetAtlasSearchCache(): void {
  atlasSearchAvailable = null;
  logger.info('Atlas Search availability cache reset');
}
