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
  loginAdmin,
  logoutAdmin,
  refreshTokenAdmin,
  toggleBlockUser,
} from '../controllers/admin.controller.js';
import { verifyAuth } from '../middlewares/verifyAuth.middleware.js';
import {
  getAllOrders,
  updateOrderStatus,
  requestReturnAdmin,
} from '../controllers/order.controller.js';
import {
  addOffer,
  toggleOfferList,
  editOffer,
  getAllOffers,
  getOneOffer,
} from '../controllers/offer.controller.js';

const router = express.Router();

router // Authorization
  .post('/login', loginAdmin)
  .post('/logout', logoutAdmin)
  .get('/refresh-token', refreshTokenAdmin);

router.use(verifyAuth(['admin'])); // These routes need authorization

router // Products
  .route('/products')
  .get(getAllProducts)
  .post(addProduct)
  .put(editProduct)
  .patch(toggleProductList);
router.get('/products/:productId', getOneProduct);

router // Genres CRUD
  .route('/genres')
  .get(getAllGenres)
  .post(addGenre)
  .put(editGenre)
  .patch(toggleGenreList);
router.get('/genres/:genreId', getOneGenre);

router // Brands CRUD
  .route('/brands')
  .get(getAllBrands)
  .post(addBrand)
  .put(editBrand)
  .patch(toggleBrandList);
router.get('/brands/:brandId', getOneBrand);

router // User CRUD
  .route('/users')
  .get(getAllUsers)
  .patch(toggleBlockUser);
router.get('/users/:userId', getOneUser);

router // Order CRUD
  .route('/order')
  .get(getAllOrders);
router
  .route('/order/:orderId')
  .patch(updateOrderStatus)
  .put(requestReturnAdmin);

router // Offer CRUD
  .route('/offers')
  .get(getAllOffers)
  .post(addOffer);
router
  .route('/offers/:offerId')
  .get(getOneOffer)
  .put(editOffer)
  .patch(toggleOfferList);

export default router;
