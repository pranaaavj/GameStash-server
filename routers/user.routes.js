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

const router = express.Router();

router
  .get('/products', getProducts)
  .get('/product/:productId', getProduct)
  .get('/products/:genre', getProductsByGenre)
  .get('/review/:productId', getReviewsByProduct)
  .post('/review', addReview);

export default router;
