import express from 'express';
import {
  addProduct,
  getAllProducts,
  toggleProductList,
  editProduct,
  getOneProduct,
} from '../controllers/product.controller.js';
import {
  addGenre,
  editGenre,
  getAllGenres,
  getOneGenre,
  toggleGenreList,
} from '../controllers/genre.controller.js';
import {
  addBrand,
  editBrand,
  getAllBrands,
  getOneBrand,
  toggleBrandList,
} from '../controllers/brand.controller.js';

const router = express.Router();

// Authorization
router.post('/login');

router // Products  CRUD
  .route('/products')
  .get(getAllProducts) // Getting all products
  .post(addProduct) // Adds a new product
  .put(editProduct) // Edits an existing product
  .patch(toggleProductList); // Toggles product listing
router.get('/products/:productId', getOneProduct); // Getting single product

router // Genres CRUD
  .route('/genres')
  .get(getAllGenres) // Getting all genres
  .post(addGenre) // Adds a new genre
  .put(editGenre) // Edits an existing genre
  .patch(toggleGenreList); // Toggles genre listing
router.get('/genres/:genreId', getOneGenre); // Getting single genre

router // Brands CRUD
  .route('/brands')
  .get(getAllBrands) // Getting all brands
  .post(addBrand) // Adds a new brand
  .put(editBrand) // Edits an existing brand
  .patch(toggleBrandList); // Toggles brand listing
router.get('/brands/:brandId', getOneBrand); // Getting single brand

export default router;
