import express from 'express';
import { verifyUser, requireVerified } from '../middleware/auth.middleware.js';
import { getMatchHistory } from '../controllers/history.controller.js';

const router = express.Router();

router.get('/', verifyUser, requireVerified, getMatchHistory);

export default router;
