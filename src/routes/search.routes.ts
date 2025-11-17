import { Router } from 'express';
import {
  search,
  getSearchSuggestions,
  getPopularSearches,
  getNoResultSearches,
  clearSearchCache,
} from '../controllers/search.controller';
import { validateSearch, validateSearchSuggestions } from '../validators/search.validator';
import { optionalAuth } from '../middlewares/auth.middleware';
import { protect, authorize } from '../middlewares/auth.middleware';
import { searchLimiter, suggestionsLimiter } from '../middlewares/rateLimiter';

const router = Router();

// Public routes with rate limiting
router.get('/', searchLimiter, optionalAuth, validateSearch, search);
router.get('/suggestions', suggestionsLimiter, validateSearchSuggestions, getSearchSuggestions);
router.get('/popular', getPopularSearches);

// Admin routes
router.get('/no-results', protect, authorize('admin'), getNoResultSearches);
router.delete('/cache', protect, authorize('admin'), clearSearchCache);

export default router;
