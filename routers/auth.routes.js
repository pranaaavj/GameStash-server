import express from 'express';
import { first } from '../controllers/auth.controller.js';

const router = express.Router();

router.get('/', first);

export default router;
