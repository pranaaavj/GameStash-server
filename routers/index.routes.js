import express from 'express';
import authRouter from './auth.routes.js';
import userRouter from './user.routes.js';

const router = express.Router();

router.use('/auth', authRouter);
router.use('/user', userRouter);

export default router;
