import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      default: null,
    },
    phoneNumber: {
      type: String,
      default: null,
      trim: true,
    },
    profilePicture: {
      type: String,
      default:
        'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSUpsDK5dkH7envHCdUECqq0XzCWK1Dv96XcQ&s',
    },
    status: {
      type: String,
      enum: ['active', 'blocked', 'pending'],
      default: 'active',
    },
    referralCode: {
      type: String,
      sparse: true,
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    firebase: {
      authenticated: { type: Boolean, default: false },
      provider: { type: String },
      uid: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

UserSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.password;
  },
});

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.method('comparePassword', async function (userPassword) {
  return bcrypt.compare(userPassword, this.password);
});

export default mongoose.model('User', UserSchema);
