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
import {
  addAddress,
  deleteAddress,
  editAddress,
  getAllAddresses,
  getOneAddress,
} from '../controllers/address.controller.js';

const router = express.Router();

router // User home products
  .get('/products', getProducts) // Get all products
  .get('/products/:genre', getProductsByGenre) // Get products by genre
  .get('/product/:productId', getProduct) // Get single product by ID
  .get('/review/:productId', getReviewsByProduct) // Get reviews by product by ID
  .post('/review', addReview); // Add a review

router // User profile
  .get('/details/:userId', getUserDetails) // Get user by ID
  .patch('/details/:userId', editUserDetails) // Edit user by ID
  .patch('/details/change-pass/:userId', changePassUser); // Change password by user ID

router // Address management
  .get('/addresses', getAllAddresses) // List all addresses
  .get('/address/:addressId', getOneAddress) // Get one address by ID
  .post('/address', addAddress) // Add a new address
  .patch('/address/:addressId', editAddress) // Update an address by ID
  .delete('/address/:addressId', deleteAddress); // Delete an address by ID

export default router;
