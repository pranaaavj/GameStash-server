export const paginate = async (model, page, limit, queryOptions = {}) => {
  const skip = (page - 1) * limit;

  const { filter = {}, sort = {}, select = '', populate = [] } = queryOptions;

  const total = await model.countDocuments();

  let query = model.find(filter).lean().skip(skip).limit(limit);

  if (sort) query = query.sort(sort);
  if (select) query = query.select(select);
  if (populate.length) populate.forEach((pop) => query.populate(pop));

  const result = await query.exec();

  return {
    result,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
  };
};
