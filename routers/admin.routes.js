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
import {
  getAllUsers,
  getOneUser,
  toggleBlockUser,
} from '../controllers/admin.controller.js';

const router = express.Router();

// Authorization
router.post('/login');

router // Products  CRUD
  .route('/products')
  .get(getAllProducts) // Getting all products
  .post(addProduct) // Adds a new product
  .put(editProduct) // Edits an existing product
  .patch(toggleProductList); // Toggles product listing
router // Getting single product
  .get('/products/:productId', getOneProduct);

router // Genres CRUD
  .route('/genres')
  .get(getAllGenres) // Getting all genres
  .post(addGenre) // Adds a new genre
  .put(editGenre) // Edits an existing genre
  .patch(toggleGenreList); // Toggles genre listing
router // Getting single genre
  .get('/genres/:genreId', getOneGenre);

router // Brands CRUD
  .route('/brands')
  .get(getAllBrands) // Getting all brands
  .post(addBrand) // Adds a new brand
  .put(editBrand) // Edits an existing brand
  .patch(toggleBrandList); // Toggles brand listing
router // Getting single brand
  .get('/brands/:brandId', getOneBrand);

router // User Management
  .route('/users')
  .get(getAllUsers) // Getting all users
  .patch(toggleBlockUser); // Getting all users
router // Getting single user
  .get('/users/:userId', getOneUser);

export default router;
