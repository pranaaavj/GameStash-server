//* Dynamic get products controller
// export const getProducts = async (req, res) => {
//   const page = parseInt(req.query.page) || 1;
//   const limit = parseInt(req.query.limit) || 10;

//   // Extract dynamic query options from the request
//   const { sortBy, priceRange, genre, platform, brand } = req.query;

//   // Initialize filter and sort options
//   const filterOptions = {};
//   let sortOption = { createdAt: -1 }; // Default sort (latest)

//   // Dynamic filter based on query parameters
//   if (priceRange) {
//     const [minPrice, maxPrice] = priceRange.split('-').map(Number);
//     filterOptions.price = { $gte: minPrice, $lte: maxPrice };
//   }

//   if (genre) filterOptions.genre = genre;
//   if (platform) filterOptions.platform = platform;
//   if (brand) filterOptions.brand = brand;

//   // Dynamic sort based on the sortBy parameter
//   const sortFields = {
//     'least-priced': { price: 1 },
//     'highest-priced': { price: -1 },
//     'latest': { createdAt: -1 },
//     'oldest': { createdAt: 1 },
//   };
//   if (sortBy && sortFields[sortBy]) {
//     sortOption = sortFields[sortBy];
//   }

//   // Build query options dynamically
//   const queryOptions = {
//     filter: filterOptions,
//     sort: sortOption,
//     populate: [
//       { path: 'genre', select: 'name -_id' },
//       { path: 'brand', select: 'name -_id' },
//     ],
//   };

//   // Use pagination function to get results
//   const products = await paginate(Product, page, limit, queryOptions);

//   if (products?.result?.length === 0) {
//     throw new NotFoundError('No products found');
//   }

//   res.status(200).json({
//     success: true,
//     message: 'User products',
//     data: {
//       products: products.result,
//       totalPages: products.totalPages,
//       currentPage: products.currentPage,
//     },
//   });
// };

//* Backup edit product schema
// export const editProductSchema = Joi.object({
//   productId: Joi.string(),
//   name: Joi.string(),
//   images: Joi.alternatives()
//     .try(
//       Joi.string().uri().label('Image URL'),
//       Joi.array()
//         .items(Joi.string().uri().label('Image URL'))
//         .label('Images Array')
//     )
//     .required()
//     .label('Images')
//     .messages({
//       'alternatives.match':
//         'Images should be either a single valid URL or an array of URLs.',
//       'string.uri': 'Each image must be a valid URL.',
//       'array.includes': 'All items in the array must be valid URLs.',
//     }),
//   price: Joi.number().positive(),
//   genre: Joi.string(),
//   platform: Joi.string().valid(
//     'PC',
//     'PlayStation',
//     'Xbox',
//     'Nintendo',
//     'Other'
//   ),
//   brand: Joi.string(),
//   stock: Joi.number().integer().min(0),
//   description: Joi.string(),
//   systemRequirements: Joi.object({
//     cpu: Joi.string().label('CPU'),
//     gpu: Joi.string().label('GPU'),
//     ram: Joi.string().label('RAM'),
//     storage: Joi.string().label('Storage'),
//   }).label('System Requirements'),
// });
