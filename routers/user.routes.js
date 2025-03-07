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
  .get('/products', getProducts) 
  .get('/products/search', searchProducts) 
  .get('/product/:productId', getProduct) 
  .get('/products/:genre', getProductsByGenre) 
  .get('/brands', getBrandsUser)
  .get('/genres', getGenresUser)
  .post('/review', addReview) 
  .get('/review/:productId', getReviewsByProduct); 

router.use(verifyAuth(['user', 'admin'])); // These routes need authentication

router // Profile management
  .get('/details/:userId', getUserDetails) 
  .patch('/details/:userId', editUserDetails) 
  .patch('/details/change-pass/:userId', changePassUser); 

router // Address management
  .route('/address')
  .post(addAddress) 
  .get(getAllAddresses);
router
  .route('/address/:addressId')
  .get(getOneAddress)
  .patch(editAddress)
  .delete(deleteAddress); 

router // Cart management
  .route('/cart')
  .get(getCart) 
  .delete(clearCart) 
  .post(addItemToCart)
  .patch(updateCartItem); 
router 
  .delete('/cart/:productId', removeItemFromCart);

router // Order functionality
  .route('/order')
  .post(placeOrder) 
  .get(getUserOrders); 
router
  .route('/order/:orderId')
  .get(getUserOrder) 
  .patch(requestReturnOrder) 
  .put(cancelOrder); 
router.post('/order/razorpay', verifyRazorpay);

export default router;
