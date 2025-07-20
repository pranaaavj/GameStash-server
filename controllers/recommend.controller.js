import util from 'util';
if (!util.isNullOrUndefined) {
  util.isNullOrUndefined = (value) => value === null || value === undefined;
}

import * as tf from '@tensorflow/tfjs-node';
import path from 'path';
import fs from 'fs';
import Order from '../models/order.model.js';
import Wishlist from '../models/wishlist.model.js';
import Cart from '../models/cart.model.js';
import Product from '../models/product.model.js';
import Genre from '../models/genre.model.js';
import Brand from '../models/brand.model.js';

const INTERACTION_WEIGHTS = {
  order: 3.0,
  wishlist: 2.0,
  cart: 1.5,
};

const fetchUserInteractions = async (userId) => {
  try {
    const userOrders = await Order.find({ user: userId })
      .populate({
        path: 'orderItems.product',
        populate: [
          { path: 'genre', model: 'Genre' },
          { path: 'brand', model: 'Brand' },
        ],
      })
      .lean();

    const orderedProducts = userOrders.flatMap((order) =>
      order.orderItems.map((item) => ({
        productId: item.product._id,
        interactionType: 'order',
        genre: item.product.genre,
        brand: item.product.brand,
        platform: item.product.platform,
        price: item.product.price,
      }))
    );

    const userWishlist = await Wishlist.findOne({ user: userId })
      .populate({
        path: 'products',
        populate: [
          { path: 'genre', model: 'Genre' },
          { path: 'brand', model: 'Brand' },
        ],
      })
      .lean();

    const wishlistProducts = userWishlist
      ? userWishlist.products.map((product) => ({
          productId: product._id,
          interactionType: 'wishlist',
          genre: product.genre,
          brand: product.brand,
          platform: product.platform,
          price: product.price,
        }))
      : [];

    const userCart = await Cart.findOne({ user: userId })
      .populate({
        path: 'items.product',
        populate: [
          { path: 'genre', model: 'Genre' },
          { path: 'brand', model: 'Brand' },
        ],
      })
      .lean();

    const cartProducts = userCart
      ? userCart.items.map((item) => ({
          productId: item.product._id,
          interactionType: 'cart',
          genre: item.product.genre,
          brand: item.product.brand,
          platform: item.product.platform,
          price: item.product.price,
        }))
      : [];

    const userInteractions = [
      ...orderedProducts,
      ...wishlistProducts,
      ...cartProducts,
    ];

    return userInteractions;
  } catch (error) {
    console.error('Error fetching user interactions:', error);
    return [];
  }
};

const createLookupMapping = (items) => {
  const mapping = {};
  items.forEach((item, index) => {
    mapping[item._id.toString()] = index + 1;
  });
  return mapping;
};

const fetchMappings = async () => {
  try {
    const allGenres = await Genre.find().lean();
    const allBrands = await Brand.find().lean();

    const genreMapping = createLookupMapping(allGenres);
    const brandMapping = createLookupMapping(allBrands);

    const platformMapping = {
      PC: 1,
      PlayStation: 2,
      Xbox: 3,
      Nintendo: 4,
      Other: 5,
    };

    return {
      genreMapping,
      brandMapping,
      platformMapping,
    };
  } catch (error) {
    console.error('∂Error fetching entity mappings:', error);
    throw error;
  }
};

const getMappingValue = (mapping, key, fallback = 0) => {
  if (!key) return fallback;
  const stringKey = key.toString();
  return mapping[stringKey] !== undefined ? mapping[stringKey] : fallback;
};

const preprocessUserData = (userInteractions, mappings) => {
  if (!userInteractions || userInteractions.length === 0) {
    return [];
  }

  const { genreMapping, brandMapping, platformMapping } = mappings;

  const normalizePrice = (price) => {
    const minPrice = 100;
    const maxPrice = 10000;
    return Math.min(Math.max((price - minPrice) / (maxPrice - minPrice), 0), 1);
  };

  return userInteractions.map((interaction) => {
    const genreId = interaction.genre?._id || interaction.genre;
    const genreValue = getMappingValue(genreMapping, genreId);

    const brandId = interaction.brand?._id || interaction.brand;
    const brandValue = getMappingValue(brandMapping, brandId);

    const platformValue = platformMapping[interaction.platform] || 0;

    const interactionWeight =
      INTERACTION_WEIGHTS[interaction.interactionType] || 1.0;

    const priceNormal = normalizePrice(interaction.price || 0);

    return [
      genreValue / 100,
      brandValue / 100,
      platformValue / 10,
      interactionWeight / 3,
      priceNormal,
    ];
  });
};

const createAndTrainModel = async (trainingData, userInteractions) => {
  if (!trainingData || trainingData.length === 0) {
    console.warn('No training data available for model');
    return null;
  }

  const model = tf.sequential();

  const inputShape = trainingData[0].length;

  model.add(
    tf.layers.dense({
      units: 32,
      activation: 'relu',
      inputShape: [inputShape],
    })
  );

  model.add(
    tf.layers.dense({
      units: 16,
      activation: 'relu',
    })
  );

  model.add(
    tf.layers.dense({
      units: 1,
      activation: 'sigmoid',
    })
  );

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'meanSquaredError',
  });

  console.log('Model created:');
  model.summary();

  const xs = tf.tensor2d(trainingData);

  const ys = tf.tensor2d(
    trainingData.map((_, i) => {
      const interaction = userInteractions[i];
      return [INTERACTION_WEIGHTS[interaction.interactionType] / 3];
    })
  );

  await model.fit(xs, ys, {
    epochs: 50,
    batchSize: 32,
    shuffle: true,
    verbose: 1,
  });

  xs.dispose();
  ys.dispose();

  return model;
};

const saveModel = async (model) => {
  if (!model) return;

  const modelDir = path.resolve('./models/recommendation');

  if (!fs.existsSync(modelDir)) {
    fs.mkdirSync(modelDir, { recursive: true });
  }

  await model.save(`file://${modelDir}`);
  console.log(`Model saved to ${modelDir}`);
};

const loadModel = async () => {
  try {
    const modelPath = path.resolve('./models/recommendation/model.json');
    const model = await tf.loadLayersModel(`file://${modelPath}`);
    console.log('Model loaded successfully');
    return model;
  } catch (error) {
    console.error('Error loading model:', error);
    return null;
  }
};

export const generateRecommendations = async (userId, limit = 10) => {
  try {
    const userInteractions = await fetchUserInteractions(userId);
    if (!userInteractions || userInteractions.length === 0) {
      return await getPopularProducts(limit);
    }

    const userPreferences = {
      genres: {},
      brands: {},
      platforms: {},
    };

    userInteractions.forEach((interaction) => {
      const genreId = interaction.genre?._id?.toString();
      if (genreId) {
        userPreferences.genres[genreId] =
          (userPreferences.genres[genreId] || 0) + 1;
      }

      const brandId = interaction.brand?._id?.toString();
      if (brandId) {
        userPreferences.brands[brandId] =
          (userPreferences.brands[brandId] || 0) + 1;
      }

      if (interaction.platform) {
        userPreferences.platforms[interaction.platform] =
          (userPreferences.platforms[interaction.platform] || 0) + 1;
      }
    });

    const mappings = await fetchMappings();

    const userFeatures = preprocessUserData(userInteractions, mappings);

    let model = await loadModel();

    if (!model) {
      console.log('No saved model found. Creating and training a new model...');
      model = await createAndTrainModel(userFeatures, userInteractions);

      if (model) {
        await saveModel(model);
      } else {
        console.warn(
          'Failed to train model. Falling back to popular products.'
        );
        return await getPopularProducts(limit);
      }
    }

    const interactedProductIds = new Set(
      userInteractions.map((interaction) => interaction.productId.toString())
    );

    const userGenres = new Set(
      userInteractions.map((i) => i.genre?._id?.toString()).filter(Boolean)
    );
    const userBrands = new Set(
      userInteractions.map((i) => i.brand?._id?.toString()).filter(Boolean)
    );
    const userPlatforms = new Set(
      userInteractions.map((i) => i.platform).filter(Boolean)
    );

    const candidateProducts = await Product.find({
      _id: { $nin: Array.from(interactedProductIds) },
      isActive: true,
      $or: [
        { genre: { $in: Array.from(userGenres) } },
        { brand: { $in: Array.from(userBrands) } },
        { platform: { $in: Array.from(userPlatforms) } },
      ],
    })
      .populate('genre brand')
      .limit(100)
      .lean();

    if (candidateProducts.length === 0) {
      console.log('No candidate products found. Returning popular products.');
      return await getPopularProducts(limit);
    }

    const candidateFeatures = candidateProducts.map((product) => {
      const genreValue = getMappingValue(
        mappings.genreMapping,
        product.genre?._id
      );
      const brandValue = getMappingValue(
        mappings.brandMapping,
        product.brand?._id
      );
      const platformValue = mappings.platformMapping[product.platform] || 0;

      const totalWeight = userInteractions.reduce((sum, interaction) => {
        return sum + (INTERACTION_WEIGHTS[interaction.interactionType] || 1.0);
      }, 0);

      const avgInteractionWeight = totalWeight / userInteractions.length;

      const normalizePrice = (price) => {
        const minPrice = 100;
        const maxPrice = 10000;
        return Math.min(
          Math.max((price - minPrice) / (maxPrice - minPrice), 0),
          1
        );
      };

      const priceNormal = normalizePrice(product.price || 0);

      return [
        genreValue / 100,
        brandValue / 100,
        platformValue / 10,
        avgInteractionWeight / 3,
        priceNormal,
      ];
    });

    const candidateTensor = tf.tensor2d(candidateFeatures);
    const predictions = model.predict(candidateTensor);
    const predictionValues = await predictions.data();

    candidateTensor.dispose();
    predictions.dispose();

    const scoredProducts = candidateProducts.map((product, index) => {
      let score = predictionValues[index];

      const genreId = product.genre?._id?.toString();
      if (genreId && userPreferences.genres[genreId]) {
        score *=
          1 + (userPreferences.genres[genreId] / userInteractions.length) * 0.5;
      }

      const brandId = product.brand?._id?.toString();
      if (brandId && userPreferences.brands[brandId]) {
        score *=
          1 + (userPreferences.brands[brandId] / userInteractions.length) * 0.3;
      }

      if (product.platform && userPreferences.platforms[product.platform]) {
        score *=
          1 +
          (userPreferences.platforms[product.platform] /
            userInteractions.length) *
            0.2;
      }

      return {
        product: product,
        score: score,
      };
    });

    scoredProducts.sort((a, b) => b.score - a.score);

    return scoredProducts.slice(0, limit).map((item) => ({
      product: item.product,
      score: parseFloat(item.score.toFixed(4)),
    }));
  } catch (error) {
    console.error('Error generating recommendations:', error);
    return await getPopularProducts(limit);
  }
};

const getPopularProducts = async (limit = 10) => {
  try {
    const popularByOrders = await Order.aggregate([
      { $unwind: '$orderItems' },
      { $group: { _id: '$orderItems.product', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit * 2 },
    ]);

    const popularByRating = await Product.find({ isActive: true })
      .sort({ averageRating: -1 })
      .limit(limit * 2)
      .lean();

    const popularProductIds = new Set();
    const recommendations = [];

    for (const item of popularByOrders) {
      if (recommendations.length >= limit) break;

      if (!popularProductIds.has(item._id.toString())) {
        popularProductIds.add(item._id.toString());

        const product = await Product.findById(item._id)
          .populate('genre brand')
          .lean();

        if (product && product.isActive) {
          recommendations.push({
            product: product,
            score: 1.0,
            reason: 'Popular Choice',
          });
        }
      }
    }

    for (const product of popularByRating) {
      if (recommendations.length >= limit) break;
      if (!popularProductIds.has(product._id.toString())) {
        popularProductIds.add(product._id.toString());
        recommendations.push({
          product: product,
          score: 0.9,
          reason: 'Highly Rated',
        });
      }
    }

    return recommendations;
  } catch (error) {
    console.error('Error fetching popular products:', error);
    return [];
  }
};

/**
 * @route GET /api/recommendations
 * @desc - Generates personalized product recommendations for a user
 * @access Private
 */
export const getRecommendations = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;

    const recommendations = await generateRecommendations(userId, limit);

    const formattedRecommendations = recommendations.map((item) => ({
      _id: item.product._id,
      name: item.product.name,
      price: item.product.price,
      images: item.product.images,
      platform: item.product.platform,
      genre: item.product.genre?.name || 'Unknown',
      brand: item.product.brand?.name || 'Unknown',
      score: item.score,
      reason: item.reason || 'Recommended for you',
    }));

    res.status(200).json({
      success: true,
      message: 'Recommendations retrieved successfully',
      data: formattedRecommendations,
    });
  } catch (error) {
    console.error('Error in recommendation API:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate recommendations',
      error: error.message,
    });
  }
};

/**
 * @route POST /api/recommendations/train
 * @desc - Trains and saves the recommendation model
 * @access Private
 */
export const trainRecommendationModel = async () => {
  try {
    console.log('Starting model training process...');

    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(1000)
      .populate({
        path: 'orderItems.product',
        populate: [
          { path: 'genre', model: 'Genre' },
          { path: 'brand', model: 'Brand' },
        ],
      })
      .lean();

    const allInteractions = [];

    for (const order of recentOrders) {
      for (const item of order.orderItems) {
        if (item.product) {
          allInteractions.push({
            productId: item.product._id,
            interactionType: 'order',
            genre: item.product.genre,
            brand: item.product.brand,
            platform: item.product.platform,
            price: item.product.price,
            userId: order.user,
          });
        }
      }
    }

    const recentWishlists = await Wishlist.find()
      .sort({ updatedAt: -1 })
      .limit(500)
      .populate({
        path: 'products',
        populate: [
          { path: 'genre', model: 'Genre' },
          { path: 'brand', model: 'Brand' },
        ],
      })
      .lean();

    for (const wishlist of recentWishlists) {
      for (const product of wishlist.products) {
        allInteractions.push({
          productId: product._id,
          interactionType: 'wishlist',
          genre: product.genre,
          brand: product.brand,
          platform: product.platform,
          price: product.price,
          userId: wishlist.user,
        });
      }
    }

    const userIds = [
      ...new Set(allInteractions.map((i) => i.userId.toString())),
    ];
    const userIdMapping = {};
    userIds.forEach((userId, index) => {
      userIdMapping[userId] = (index + 1) / userIds.length;
    });

    const mappings = await fetchMappings();

    const baseFeatures = preprocessUserData(allInteractions, mappings);

    const features = baseFeatures.map((feature, index) => {
      const interaction = allInteractions[index];
      const userFeature = userIdMapping[interaction.userId.toString()] || 0;
      return [...feature, userFeature];
    });

    console.log(`Prepared ${features.length} interactions for training`);

    const targets = allInteractions.map((interaction) => [
      INTERACTION_WEIGHTS[interaction.interactionType] / 3,
    ]);

    const model = tf.sequential();
    model.add(
      tf.layers.dense({
        units: 32,
        activation: 'relu',
        inputShape: [6],
      })
    );

    model.add(
      tf.layers.dense({
        units: 16,
        activation: 'relu',
      })
    );

    model.add(
      tf.layers.dense({
        units: 1,
        activation: 'sigmoid',
      })
    );

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
    });

    const xs = tf.tensor2d(features);
    const ys = tf.tensor2d(targets);

    await model.fit(xs, ys, {
      epochs: 100,
      batchSize: 32,
      validationSplit: 0.2,
      shuffle: true,
      verbose: 1,
    });

    xs.dispose();
    ys.dispose();

    await saveModel(model);

    console.log('Model training completed and model saved');
    return { success: true };
  } catch (error) {
    console.error('Error training recommendation model:', error);
    return { success: false };
  }
};
