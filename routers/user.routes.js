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
import {
  getCart,
  addItemToCart,
  updateCartItem,
  removeItemFromCart,
  clearCart,
} from '../controllers/cart.controller.js';
import { verifyAuth } from '../middlewares/verifyAuth.middleware.js';

const router = express.Router();

router // User home products
  .get('/products', getProducts) // Get all products
  .get('/products/:genre', getProductsByGenre) // Get products by genre
  .get('/product/:productId', getProduct) // Get single product by ID
  .get('/review/:productId', getReviewsByProduct) // Get reviews by product by ID
  .post('/review', addReview); // Add a review

router.use(verifyAuth(['user', 'admin'])); // These routes need authentication

router // Profile management
  .get('/details/:userId', getUserDetails) // Get user by ID
  .patch('/details/:userId', editUserDetails) // Edit user by ID
  .patch('/details/change-pass/:userId', changePassUser); // Change password by user ID

router // Address management
  .route('/address')
  .get(getAllAddresses) // List all addresses of user
  .post(addAddress); // Add a new address
router
  .route('/address/:addressId')
  .get(getOneAddress) // Get one address by ID
  .patch(editAddress) // Update an address by ID
  .delete(deleteAddress); // Delete an address by ID

router // Cart management
  .route('/cart')
  .get(getCart) // Get the cart for a specific user
  .post(addItemToCart) // Add an item to the cart
  .patch(updateCartItem) // Update the quantity of a specific item
  .delete(clearCart); // Clear the entire cart
router // Remove an item from the cart
  .delete('/cart/:productId', removeItemFromCart);

export default router;
