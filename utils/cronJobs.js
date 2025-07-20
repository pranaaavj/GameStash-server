import cron from 'node-cron';
import Offer from '../models/offer.model.js';
import Coupon from '../models/coupon.model.js';
import Product from '../models/product.model.js';
import { selectBestOfferForProduct } from './bestOfferForProduct.js';
import { trainRecommendationModel } from '../controllers/recommend.controller.js';

export const expiredOffersJob = () => {
  cron.schedule('* * * * *', async () => {
    const currentTime = new Date();

    const expiredOffers = await Offer.find({
      endDate: { $lt: currentTime },
    });

    if (!expiredOffers.length) return;

    const expiredOfferIds = expiredOffers.map((offer) => offer._id.toString());
    await Offer.updateMany(
      { _id: { $in: expiredOfferIds } },
      { isActive: false }
    );

    const expiredBrandOffers = expiredOffers.filter(
      (offer) => offer.type === 'Brand'
    );

    const expiredProductOffers = expiredOffers.filter(
      (offer) => offer.type === 'Product'
    );

    const affectedProductIds = new Set();

    if (expiredBrandOffers.length) {
      const brandIds = expiredBrandOffers.map((offer) => offer.targetId);

      const brandProducts = await Product.find({ brand: { $in: brandIds } });

      for (const product of brandProducts) {
        product.applicableOffers = product.applicableOffers.filter(
          (offerId) => !expiredOfferIds.includes(offerId.toString())
        );
        affectedProductIds.add(product._id.toString());
      }

      await Product.updateMany(
        { _id: { $in: [...affectedProductIds] } },
        { $pull: { applicableOffers: { $in: expiredOfferIds } } }
      );
    }

    if (expiredProductOffers.length) {
      const productIds = expiredProductOffers.map((offer) => offer.targetId);

      await Product.updateMany(
        { _id: { $in: productIds } },
        { $pull: { applicableOffers: { $in: expiredOfferIds } } }
      );

      productIds.forEach((id) => affectedProductIds.add(id));
    }

    if (affectedProductIds.size) {
      for (const productId of affectedProductIds) {
        await selectBestOfferForProduct(productId);
      }
    }
  });
};

export const expiredCouponsJob = () => {
  cron.schedule('* * * * *', async () => {
    const currentTime = new Date();

    const result = await Coupon.updateMany(
      { endDate: { $lt: currentTime }, isActive: true },
      { isActive: false }
    );

    if (result.modifiedCount > 0) {
      console.log(`Deactivated ${result.modifiedCount} expired coupons.`);
    }
  });
};

export const trainingRecommendationModelJob = () => {
  cron.schedule('0 2 * * *', async () => {
    console.log('Running scheduled model training...');

    const result = await trainRecommendationModel();
    if (result.success) {
      console.log('Training was successfully completed.');
    } else {
      console.log('Error occurred while retraining model.');
    }
  });
};

expiredOffersJob();
expiredCouponsJob();
trainingRecommendationModelJob();
