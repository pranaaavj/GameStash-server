import express from 'express';
import { addProduct, getProducts } from '../controllers/product.controller.js';
import { getGenres } from '../controllers/genre.controller.js';
import { getBrands } from '../controllers/brand.controller.js';

const router = express.Router();

router
  .post('/login')
  .get('/products', getProducts)
  .get('/genres', getGenres)
  .get('/brands', getBrands)
  .post('/products', addProduct);

export default router;
