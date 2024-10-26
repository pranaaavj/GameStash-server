import express from 'express';
import authRouter from './auth.routes.js';
import adminRouter from './admin.routes.js';
import userRouter from './user.routes.js';

//Don't forget to add this middleware to admin router
import { verifyAuth } from '../middlewares/verifyAuth.middleware.js';

const router = express.Router();

router.use('/auth', authRouter);
router.use('/admin', adminRouter);
router.use('/user', userRouter);

export default router;
