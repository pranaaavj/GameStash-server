import mongoose from 'mongoose';
import faker from 'faker';
import dotenv from 'dotenv';
import User from '../models/user.model.js';
import Product from '../models/product.model.js';
import Brand from '../models/brand.model.js';
import Genre from '../models/genre.model.js';
import Coupon from '../models/coupon.model.js';
import Offer from '../models/offer.model.js';
import Order from '../models/order.model.js';
import Wishlist from '../models/wishlist.model.js';
import Cart from '../models/cart.model.js';
import Address from '../models/address.model.js';

dotenv.config();

const MONGO_URI = 'mongodb://localhost:27017/GameStash';

mongoose.connect(MONGO_URI);

const seedDatabase = async () => {
  try {
    console.log('Seeding database...');

    // Clear existing data
    await User.deleteMany();
    await Product.deleteMany();
    await Brand.deleteMany();
    await Genre.deleteMany();
    await Coupon.deleteMany();
    await Offer.deleteMany();
    await Order.deleteMany();
    await Wishlist.deleteMany();
    await Cart.deleteMany();
    await Address.deleteMany();

    // Create Brands
    const brandNames = [
      'Rockstar',
      'Ubisoft',
      'EA',
      'Bethesda',
      'CD Projekt Red',
    ];
    const brands = await Brand.insertMany(
      brandNames.map((name) => ({ name, isActive: true }))
    );

    // Create Genres
    const genreNames = ['Action', 'RPG', 'Shooter', 'Adventure', 'Strategy'];
    const genres = await Genre.insertMany(
      genreNames.map((name) => ({ name, isActive: true }))
    );

    // Create Users
    const users = await User.insertMany(
      [...Array(20)].map(() => ({
        name: faker.name.findName(),
        email: faker.internet.email(),
        password: faker.internet.password(),
        role: 'user',
        status: 'active',
      }))
    );

    const gameImages = [
      'https://cdn.cloudflare.steamstatic.com/steam/apps/1091500/header.jpg', // Cyberpunk 2077
      'https://cdn.cloudflare.steamstatic.com/steam/apps/582660/header.jpg', // Black Desert Online
      'https://cdn.cloudflare.steamstatic.com/steam/apps/271590/header.jpg', // GTA V
      'https://cdn.cloudflare.steamstatic.com/steam/apps/292030/header.jpg', // The Witcher 3
      'https://cdn.cloudflare.steamstatic.com/steam/apps/359550/header.jpg', // Rainbow Six Siege
      'https://cdn.cloudflare.steamstatic.com/steam/apps/578080/header.jpg', // PUBG
      'https://cdn.cloudflare.steamstatic.com/steam/apps/1085660/header.jpg', // Destiny 2
      'https://cdn.cloudflare.steamstatic.com/steam/apps/1245620/header.jpg', // Elden Ring
      'https://cdn.cloudflare.steamstatic.com/steam/apps/413150/header.jpg', // Stardew Valley
      'https://cdn.cloudflare.steamstatic.com/steam/apps/252490/header.jpg', // Rust
      'https://cdn.cloudflare.steamstatic.com/steam/apps/730/header.jpg', // CS:GO
      'https://cdn.cloudflare.steamstatic.com/steam/apps/381210/header.jpg', // Dead by Daylight
      'https://cdn.cloudflare.steamstatic.com/steam/apps/550/header.jpg', // Left 4 Dead 2
      'https://cdn.cloudflare.steamstatic.com/steam/apps/306130/header.jpg', // Elder Scrolls Online
      'https://cdn.cloudflare.steamstatic.com/steam/apps/275850/header.jpg', // No Man's Sky
      'https://cdn.cloudflare.steamstatic.com/steam/apps/1172470/header.jpg', // Apex Legends
      'https://cdn.cloudflare.steamstatic.com/steam/apps/1145360/header.jpg', // Hades
      'https://cdn.cloudflare.steamstatic.com/steam/apps/812140/header.jpg', // Assassin's Creed Odyssey
      'https://cdn.cloudflare.steamstatic.com/steam/apps/578080/header.jpg', // PUBG: Battlegrounds
      'https://cdn.cloudflare.steamstatic.com/steam/apps/1217060/header.jpg', // Halo: The Master Chief Collection
    ];

    // Create Products (Games)
    const products = await Product.insertMany(
      [...Array(30)].map(() => ({
        name: faker.commerce.productName(),
        description: faker.lorem.sentence(),
        images: [
          faker.random.arrayElement(gameImages),
          faker.random.arrayElement(gameImages),
          faker.random.arrayElement(gameImages),
        ],
        price: faker.datatype.number({ min: 1000, max: 5000 }),
        stock: faker.datatype.number({ min: 5, max: 100 }),
        genre: faker.random.arrayElement(genres)._id,
        brand: faker.random.arrayElement(brands)._id,
        platform: faker.random.arrayElement(['PC', 'PlayStation', 'Xbox']),
        systemRequirements: {
          cpu: faker.commerce.productName(),
          gpu: faker.commerce.productName(),
          ram: `${faker.datatype.number({ min: 4, max: 32 })}GB`,
          storage: `${faker.datatype.number({ min: 20, max: 200 })}GB`,
        },
        rating: faker.datatype.float({ min: 2, max: 5 }),
        isActive: true,
      }))
    );

    // Create Addresses
    const addresses = await Address.insertMany(
      users.map((user) => ({
        user: user._id,
        addressName: faker.address.streetName(),
        addressLine: faker.address.streetAddress(),
        city: faker.address.city(),
        state: faker.address.state(),
        zip: faker.address.zipCode(),
        country: faker.address.country(),
        isDefault: faker.datatype.boolean(),
      }))
    );

    // Create Wishlist
    await Wishlist.insertMany(
      users.map((user) => ({
        user: user._id,
        products: [
          faker.random.arrayElement(products)._id,
          faker.random.arrayElement(products)._id,
        ],
      }))
    );

    // Create Cart
    await Cart.insertMany(
      users.map((user) => ({
        user: user._id,
        items: [
          {
            product: faker.random.arrayElement(products)._id,
            quantity: faker.datatype.number({ min: 1, max: 5 }),
          },
          {
            product: faker.random.arrayElement(products)._id,
            quantity: faker.datatype.number({ min: 1, max: 5 }),
          },
        ],
      }))
    );

    // Create Orders
    await Order.insertMany(
      users.map((user) => {
        const orderItems = [
          {
            product: faker.random.arrayElement(products)._id,
            quantity: faker.datatype.number({ min: 1, max: 3 }),
            price: faker.datatype.number({ min: 1000, max: 5000 }),
            totalPrice: faker.datatype.number({ min: 1000, max: 15000 }),
            status: 'Delivered',
          },
        ];

        const totalAmount = orderItems.reduce(
          (acc, item) => acc + item.totalPrice,
          0
        );
        const totalDiscount = faker.datatype.number({ min: 300, max: 800 });
        const finalPrice = totalAmount - totalDiscount;

        return {
          user: user._id,
          orderItems,
          shippingAddress: faker.random.arrayElement(addresses),
          totalAmount,
          totalDiscount,
          finalPrice,
          paymentMethod: faker.random.arrayElement([
            'Wallet',
            'Razorpay',
            'Cash on Delivery',
          ]),
          paymentStatus: faker.random.arrayElement(['Paid', 'Pending']),
          orderStatus: 'Delivered',
          razorpayOrderId: faker.datatype.uuid(),
          refundedAmount: 0,
          placedAt: faker.date.past(),
        };
      })
    );

    console.log('Database seeded successfully.');
    mongoose.connection.close();
  } catch (error) {
    console.error('Error seeding database:', error);
    mongoose.connection.close();
  }
};

seedDatabase();
