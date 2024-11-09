import mongoose from 'mongoose';

const AddressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    addressName: {
      type: String,
      trim: true,
      Required: true,
    },
    addressLine: {
      type: String,
      trim: true,
      Required: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
      required: true,
    },
    zip: {
      type: String,
      trim: true,
      required: true,
    },
    country: {
      type: String,
      trim: true,
      required: true,
    },
  },
  { timestamps: true }
);

AddressSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.password;
    delete ret.createdAt;
    delete ret.updatedAt;
  },
});

export default mongoose.model('Address', AddressSchema);
