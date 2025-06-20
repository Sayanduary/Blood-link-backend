import express from 'express';
import {
  getNgoProfile,
  updateNgoProfile,
  getNgoStats
} from '../controllers/ngoController.js';
import { protect } from '../middleware/authMiddleware.js';
import { restrictTo } from '../middleware/roleMiddleware.js';

const router = express.Router();

/**
 * @route /api/ngos
 * @created 2025-06-20 17:47:26 by Sayanduary
 */

// Public routes
router.get('/:id', getNgoProfile);

// Protected routes
router.use(protect);

// NGO only routes
router.use(restrictTo('ngo', 'admin'));
router.put('/profile', updateNgoProfile);
router.get('/stats', getNgoStats);

export default router;