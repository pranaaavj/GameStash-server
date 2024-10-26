export const paginate = async (model, page, limit) => {
  const skip = (page - 1) * limit;

  const total = await model.countDocuments();
  const result = await model.find().lean().skip(skip).limit(limit);

  return {
    result,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
  };
};
