export const paginate = async (model, page, limit, queryOptions = {}) => {
  const skip = (page - 1) * limit;

  const { filter = {}, sort = {}, select = '', populate = [] } = queryOptions;

  const total = await model.countDocuments(filter);
  let query = model.find(filter).lean().skip(skip).limit(limit);

  if (Object.keys(sort).length) query = query.sort(sort);
  if (select) query = query.select(select);

  if (populate.length) {
    for (const pop of populate) {
      query = query.populate(pop);
    }
  }

  const result = await query.exec();

  return {
    result,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
  };
};
