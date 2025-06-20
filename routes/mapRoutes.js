import express from 'express';
import {
  getDonorHeatmap,
  getCampMap,
  getRequestMap
} from '../controllers/mapController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @route /api/map
 * @created 2025-06-20 17:47:26 by Sayanduary
 */

// Public route for camp map
router.get('/camps', getCampMap);

// Protected routes
router.use(protect);
router.get('/donors', getDonorHeatmap);
router.get('/requests', getRequestMap);

export default router;