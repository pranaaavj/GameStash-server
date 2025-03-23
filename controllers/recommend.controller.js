import * as tf from '@tensorflow/tfjs-node';
import path from 'path';
import fs from 'fs';
import Order from '../models/order.model.js';
import Wishlist from '../models/wishlist.model.js';
import Cart from '../models/cart.model.js';
import Product from '../models/product.model.js';
import Genre from '../models/genre.model.js';
import Brand from '../models/brand.model.js';

// Constants for feature scaling
const INTERACTION_WEIGHTS = {
  order: 3.0, // Highest weight - user actually purchased
  wishlist: 2.0, // Medium weight - user interested enough to save
  cart: 1.5, // Lower weight - interest shown but no commitment yet
};

/**
 * Fetches all user interactions (orders, wishlist, cart) for recommendation processing
 * @param {string} userId - The ID of the user
 * @returns {Promise<Array>} - Array of user interactions with product details
 */
const fetchUserInteractions = async (userId) => {
  try {
    // Fetch orders and extract product information
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

    // Fetch wishlist items
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

    // Fetch cart items
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

    // Combine all interactions
    const userInteractions = [
      ...orderedProducts,
      ...wishlistProducts,
      ...cartProducts,
    ];

    console.log(`✅ Fetched ${userInteractions.length} user interactions`);
    return userInteractions;
  } catch (error) {
    console.error('❌ Error fetching user interactions:', error);
    return [];
  }
};

/**
 * Creates a lookup mapping for entity IDs to numeric indices
 * @param {Array} items - Array of items with unique IDs to map
 * @returns {Object} - Mapping of ID to numeric index
 */
const createLookupMapping = (items) => {
  const mapping = {};
  items.forEach((item, index) => {
    mapping[item._id.toString()] = index + 1; // +1 to avoid 0 index (0 will be reserved for unknown)
  });
  return mapping;
};

/**
 * Fetches all necessary mappings for feature encoding
 * @returns {Promise<Object>} - Object containing all mappings
 */
const fetchMappings = async () => {
  try {
    // Fetch all genres and brands for proper encoding
    const allGenres = await Genre.find().lean();
    const allBrands = await Brand.find().lean();

    // Create mappings for genres and brands
    const genreMapping = createLookupMapping(allGenres);
    const brandMapping = createLookupMapping(allBrands);

    // Create platform mapping
    const platformMapping = {
      PC: 1,
      PlayStation: 2,
      Xbox: 3,
      Nintendo: 4,
      Mobile: 5,
    };

    return {
      genreMapping,
      brandMapping,
      platformMapping,
    };
  } catch (error) {
    console.error('❌ Error fetching entity mappings:', error);
    throw error;
  }
};

/**
 * Safely gets mapping value with fallback to ensure no NaN or undefined values
 * @param {Object} mapping - The mapping object
 * @param {string} key - The key to look up
 * @param {number} fallback - Fallback value if key not found
 * @returns {number} - The mapped numeric value
 */
const getMappingValue = (mapping, key, fallback = 0) => {
  if (!key) return fallback;
  const stringKey = key.toString();
  return mapping[stringKey] !== undefined ? mapping[stringKey] : fallback;
};

/**
 * Preprocesses user interaction data into model input features
 * @param {Array} userInteractions - Array of user interactions
 * @param {Object} mappings - Object containing ID to index mappings
 * @returns {Array} - Array of feature vectors ready for model input
 */
const preprocessUserData = (userInteractions, mappings) => {
  if (!userInteractions || userInteractions.length === 0) {
    return [];
  }

  const { genreMapping, brandMapping, platformMapping } = mappings;

  // Normalize price function - using min-max scaling
  // This will keep prices within a reasonable range (0-1)
  const normalizePrice = (price) => {
    const minPrice = 100; // Minimum expected price
    const maxPrice = 10000; // Maximum expected price
    return Math.min(Math.max((price - minPrice) / (maxPrice - minPrice), 0), 1);
  };

  return userInteractions.map((interaction) => {
    // Handle genre mapping safely
    const genreId = interaction.genre?._id || interaction.genre;
    const genreValue = getMappingValue(genreMapping, genreId);

    // Handle brand mapping safely
    const brandId = interaction.brand?._id || interaction.brand;
    const brandValue = getMappingValue(brandMapping, brandId);

    // Get platform value with fallback
    const platformValue = platformMapping[interaction.platform] || 0;

    // Get interaction weight
    const interactionWeight =
      INTERACTION_WEIGHTS[interaction.interactionType] || 1.0;

    // Normalize price safely
    const priceNormal = normalizePrice(interaction.price || 0);

    // Return feature vector with properly scaled values
    return [
      genreValue / 100, // Scale down genre ID to avoid large numbers
      brandValue / 100, // Scale down brand ID
      platformValue / 10, // Scale down platform
      interactionWeight / 3, // Scale interaction weight
      priceNormal, // Already normalized 0-1
    ];
  });
};

/**
 * Creates and trains a TensorFlow.js model for recommendations
 * @param {Array} trainingData - Preprocessed training data
 * @returns {Promise<tf.LayersModel>} - Trained TensorFlow model
 */
const createAndTrainModel = async (trainingData, userInteractions) => {
  // If no data available, return null
  if (!trainingData || trainingData.length === 0) {
    console.warn('⚠️ No training data available for model');
    return null;
  }

  // Create a simple model for collaborative filtering
  const model = tf.sequential();

  // Input shape is the number of features (5 in our case)
  const inputShape = trainingData[0].length;

  // Add layers
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

  // Output layer - single value representing recommendation score
  model.add(
    tf.layers.dense({
      units: 1,
      activation: 'sigmoid', // Outputs between 0 and 1
    })
  );

  // Compile the model
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'meanSquaredError',
  });

  console.log('✅ Model created:');
  model.summary();

  // Create training data tensors
  const xs = tf.tensor2d(trainingData);

  // For training, we'll use a simple heuristic - items user interacted with are positive examples
  // The stronger the interaction (order > wishlist > cart), the higher the target value
  const ys = tf.tensor2d(
    trainingData.map((_, i) => {
      const interaction = userInteractions[i];
      return [INTERACTION_WEIGHTS[interaction.interactionType] / 3];
    })
  );

  // Train the model
  await model.fit(xs, ys, {
    epochs: 50,
    batchSize: 32,
    shuffle: true,
    verbose: 1,
  });

  // Clean up tensors
  xs.dispose();
  ys.dispose();

  return model;
};

/**
 * Saves the trained model to the file system
 * @param {tf.LayersModel} model - Trained TensorFlow model
 * @returns {Promise<void>}
 */
const saveModel = async (model) => {
  if (!model) return;

  const modelDir = path.resolve('./models/recommendation');

  // Ensure directory exists
  if (!fs.existsSync(modelDir)) {
    fs.mkdirSync(modelDir, { recursive: true });
  }

  await model.save(`file://${modelDir}`);
  console.log(`✅ Model saved to ${modelDir}`);
};

/**
 * Loads a trained model from the file system
 * @returns {Promise<tf.LayersModel>} - Loaded TensorFlow model
 */
const loadModel = async () => {
  try {
    const modelPath = path.resolve('./models/recommendation/model.json');
    const model = await tf.loadLayersModel(`file://${modelPath}`);
    console.log('✅ Model loaded successfully');
    return model;
  } catch (error) {
    console.error('❌ Error loading model:', error);
    return null;
  }
};

/**
 * Generates product recommendations for a user
 * @param {string} userId - The ID of the user
 * @param {number} limit - Maximum number of recommendations to return
 * @returns {Promise<Array>} - Array of recommended products
 */
export const generateRecommendations = async (userId, limit = 10) => {
  try {
    // Step 1: Fetch user interactions
    const userInteractions = await fetchUserInteractions(userId);
    console.log(userInteractions);
    if (!userInteractions || userInteractions.length === 0) {
      console.log('⚠️ No user interactions found. Returning popular products.');
      return await getPopularProducts(limit);
    }

    // In generateRecommendations
    // Extract user preferences from interactions
    const userPreferences = {
      genres: {},
      brands: {},
      platforms: {},
    };

    userInteractions.forEach((interaction) => {
      // Count genre preferences
      const genreId = interaction.genre?._id?.toString();
      if (genreId) {
        userPreferences.genres[genreId] =
          (userPreferences.genres[genreId] || 0) + 1;
      }

      // Count brand preferences
      const brandId = interaction.brand?._id?.toString();
      if (brandId) {
        userPreferences.brands[brandId] =
          (userPreferences.brands[brandId] || 0) + 1;
      }

      // Count platform preferences
      if (interaction.platform) {
        userPreferences.platforms[interaction.platform] =
          (userPreferences.platforms[interaction.platform] || 0) + 1;
      }
    });

    // Step 2: Fetch necessary mappings for feature encoding
    const mappings = await fetchMappings();

    // Step 3: Preprocess user data
    const userFeatures = preprocessUserData(userInteractions, mappings);
    console.log(
      `✅ Processed ${userFeatures.length} interactions for prediction`
    );

    // Step 4: Load model (or train if needed)
    let model = await loadModel();

    if (!model) {
      console.log(
        '⚠️ No saved model found. Creating and training a new model...'
      );
      model = await createAndTrainModel(userFeatures, userInteractions);

      if (model) {
        await saveModel(model);
      } else {
        console.warn(
          '❌ Failed to train model. Falling back to popular products.'
        );
        return await getPopularProducts(limit);
      }
    }

    // Step 5: Get candidate products to score (exclude products user already interacted with)
    const interactedProductIds = new Set(
      userInteractions.map((interaction) => interaction.productId.toString())
    );

    // Get user's preferred genres, brands, platforms
    const userGenres = new Set(
      userInteractions.map((i) => i.genre?._id?.toString()).filter(Boolean)
    );
    const userBrands = new Set(
      userInteractions.map((i) => i.brand?._id?.toString()).filter(Boolean)
    );
    const userPlatforms = new Set(
      userInteractions.map((i) => i.platform).filter(Boolean)
    );

    // Get products similar to user preferences but not interacted with
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
      console.log(
        '⚠️ No candidate products found. Returning popular products.'
      );
      return await getPopularProducts(limit);
    }

    // Step 6: Prepare candidate products for prediction
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

      // Use average interaction weight for candidates
      const totalWeight = userInteractions.reduce((sum, interaction) => {
        return sum + (INTERACTION_WEIGHTS[interaction.interactionType] || 1.0);
      }, 0);

      const avgInteractionWeight = totalWeight / userInteractions.length;

      // Normalize price
      const normalizePrice = (price) => {
        const minPrice = 100;
        const maxPrice = 10000;
        return Math.min(
          Math.max((price - minPrice) / (maxPrice - minPrice), 0),
          1
        );
      };

      const priceNormal = normalizePrice(product.price || 0);

      // Return normalized feature vector
      return [
        genreValue / 100,
        brandValue / 100,
        platformValue / 10,
        avgInteractionWeight / 3,
        priceNormal,
      ];
    });

    // Step 7: Run predictions
    const candidateTensor = tf.tensor2d(candidateFeatures);
    const predictions = model.predict(candidateTensor);
    const predictionValues = await predictions.data();

    // Clean up tensors
    candidateTensor.dispose();
    predictions.dispose();

    const scoredProducts = candidateProducts.map((product, index) => {
      let score = predictionValues[index];

      // Boost score based on genre match
      const genreId = product.genre?._id?.toString();
      if (genreId && userPreferences.genres[genreId]) {
        score *=
          1 + (userPreferences.genres[genreId] / userInteractions.length) * 0.5;
      }

      // Boost score based on brand match
      const brandId = product.brand?._id?.toString();
      if (brandId && userPreferences.brands[brandId]) {
        score *=
          1 + (userPreferences.brands[brandId] / userInteractions.length) * 0.3;
      }

      // Boost score based on platform match
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

    // Step 8: Sort and return top recommendations
    scoredProducts.sort((a, b) => b.score - a.score);

    // Return top recommendations
    return scoredProducts.slice(0, limit).map((item) => ({
      product: item.product,
      score: parseFloat(item.score.toFixed(4)),
    }));
  } catch (error) {
    console.error('❌ Error generating recommendations:', error);
    return await getPopularProducts(limit);
  }
};

/**
 * Fetches popular products as a fallback recommendation strategy
 * @param {number} limit - Maximum number of products to return
 * @returns {Promise<Array>} - Array of popular products
 */
const getPopularProducts = async (limit = 10) => {
  try {
    // Get products with highest order counts
    const popularByOrders = await Order.aggregate([
      { $unwind: '$orderItems' },
      { $group: { _id: '$orderItems.product', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit * 2 }, // Get more than needed for diversity
    ]);

    // Get highest rated products
    const popularByRating = await Product.find({ isActive: true })
      .sort({ averageRating: -1 })
      .limit(limit * 2)
      .lean();

    // Combine and deduplicate
    const popularProductIds = new Set();
    const recommendations = [];

    // First, add products popular by orders
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

    // Then add highly rated products
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
    console.error('❌ Error fetching popular products:', error);
    return [];
  }
};

/**
 * API endpoint to get recommendations for a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getRecommendations = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;

    const recommendations = await generateRecommendations(userId, limit);

    // Format the response
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
    console.error('❌ Error in recommendation API:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate recommendations',
      error: error.message,
    });
  }
};

/**
 * Function to train the recommendation model and save it
 * Can be called periodically or as a maintenance task
 */
export const trainRecommendationModel = async () => {
  try {
    console.log('🔄 Starting model training process...');

    // Get a sample of recent user interactions across all users
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

    // Process orders
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

    // Add wishlist and cart data (sample)
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
      userIdMapping[userId] = (index + 1) / userIds.length; // Normalize to 0-1
    });

    // Get mappings for encoding
    const mappings = await fetchMappings();

    // Process features
    const baseFeatures = preprocessUserData(allInteractions, mappings);

    // Add user ID as the 6th feature
    const features = baseFeatures.map((feature, index) => {
      const interaction = allInteractions[index];
      const userFeature = userIdMapping[interaction.userId.toString()] || 0;
      return [...feature, userFeature];
    });

    console.log(`✅ Prepared ${features.length} interactions for training`);

    // Create target values based on interaction type
    const targets = allInteractions.map((interaction) => [
      INTERACTION_WEIGHTS[interaction.interactionType] / 3, // Normalize to 0-1
    ]);

    // Create and train model
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

    // Train the model
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

    // Save the model
    await saveModel(model);

    console.log('✅ Model training completed and model saved');
    return true;
  } catch (error) {
    console.error('❌ Error training recommendation model:', error);
    return false;
  }
};
