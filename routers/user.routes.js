import express from 'express';
import {
  getProduct,
  getProducts,
  getProductsByGenre,
} from '../controllers/product.controller.js';
import {
  addReview,
  getReviewsByProduct,
} from '../controllers/review.controller.js';
import {
  getUserDetails,
  editUserDetails,
  changePassUser,
} from '../controllers/user.controller.js';

const router = express.Router();

router
  .get('/products', getProducts)
  .get('/products/:genre', getProductsByGenre)
  .get('/product/:productId', getProduct)
  .get('/review/:productId', getReviewsByProduct)
  .post('/review', addReview);

router
  .get('/details/:userId', getUserDetails)
  .patch('/details/:userId', editUserDetails)
  .patch('/details/change-pass/:userId', changePassUser);

export default router;
