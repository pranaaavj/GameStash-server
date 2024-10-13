import express from 'express';
import { homePage } from '../controllers/user.controller.js';
import { verifyAuth } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/home-page', verifyAuth(['admin']), homePage);

export default router;
