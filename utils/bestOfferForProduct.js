import Product from '../models/product.model.js';

export const selectBestOfferForProduct = async (productId) => {
  const product = await Product.findById(productId).populate(
    'applicableOffers'
  );

  if (!product) {
    return null;
  }

  let bestOffer = null;
  let bestDiscount = 0;
  let newDiscountedPrice = product.price;

  for (const offer of product.applicableOffers) {
    if (!offer.isActive) {
      continue;
    }

    let discountValue = 0;
    if (offer.discountType === 'percentage') {
      discountValue = (product.price * offer.discountValue) / 100;
    } else {
      discountValue = offer.discountValue;
    }

    if (discountValue > bestDiscount) {
      bestDiscount = discountValue;
      bestOffer = offer;
      newDiscountedPrice = Math.max(product.price - discountValue, 0);
    }
  }

  product.bestOffer = bestOffer ? bestOffer._id : null;
  product.discountedPrice = bestOffer ? newDiscountedPrice.toFixed(2) : null;

  await product.save();
};
