import express from 'express';
import {
  getProduct,
  getProducts,
  getProductsByGenre,
  searchProducts,
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
import {
  cancelOrder,
  getUserOrders,
  requestReturnOrder,
  placeOrder,
  getUserOrder,
  verifyRazorpay,
} from '../controllers/order.controller.js';
import { getBrandsUser } from '../controllers/brand.controller.js';
import { getGenresUser } from '../controllers/genre.controller.js';

const router = express.Router();

router // User home products
  .get('/products', getProducts) // Get all products
  .get('/products/search', searchProducts) // Search products
  .get('/product/:productId', getProduct) // Get single product by ID
  .get('/products/:genre', getProductsByGenre) // Get products by genre
  .get('/brands', getBrandsUser) // Get all brands
  .get('/genres', getGenresUser) // Get all genres
  .post('/review', addReview) // Add a review
  .get('/review/:productId', getReviewsByProduct); // Get reviews by product by ID

router.use(verifyAuth(['user', 'admin'])); // These routes need authentication

router // Profile management
  .get('/details/:userId', getUserDetails) // Get user by ID
  .patch('/details/:userId', editUserDetails) // Edit user by ID
  .patch('/details/change-pass/:userId', changePassUser); // Change password by user ID

router // Address management
  .route('/address')
  .post(addAddress) // Add a new address
  .get(getAllAddresses); // List all addresses of user
router
  .route('/address/:addressId')
  .get(getOneAddress) // Get one address by ID
  .patch(editAddress) // Update an address by ID
  .delete(deleteAddress); // Delete an address by ID

router // Cart management
  .route('/cart')
  .get(getCart) // Get the cart for a specific user
  .delete(clearCart) // Clear the entire cart
  .post(addItemToCart) // Add an item to the cart
  .patch(updateCartItem); // Update the quantity of a specific item
router // Remove an item from the cart
  .delete('/cart/:productId', removeItemFromCart);

router // Order functionality
  .route('/order')
  .post(placeOrder) // Place an order
  .get(getUserOrders); // Get all orders of a user
router
  .route('/order/:orderId')
  .get(getUserOrder) // Get a specific order by ID
  .patch(requestReturnOrder) // Request an order return
  .put(cancelOrder); // Cancel a order
router.post('/order/razorpay', verifyRazorpay);

export default router;
