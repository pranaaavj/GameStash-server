export const aggregatePaginate = async (
  model,
  page,
  limit,
  aggregateOptions = {}
) => {
  const skip = (page - 1) * limit;
  const {
    filter = {},
    sort = {},
    select = '',
    populate = [],
  } = aggregateOptions;

  const pipeline = [{ $match: filter }];

  populate.forEach((pop) => {
    if (!pop.from || !pop.localField || !pop.as) {
      throw new Error(
        "Missing required fields in populate options: 'from', 'localField', or 'as'."
      );
    }

    const lookupStage = {
      $lookup: {
        from: pop.from,
        localField: pop.localField,
        foreignField: pop.foreignField || '_id',
        as: pop.as,
      },
    };

    pipeline.push(lookupStage);

    if (pop.single) pipeline.push({ $unwind: `$${pop.as}` });
    if (pop.match)
      pipeline.push({ $match: { [`${pop.as}.isActive`]: true, ...pop.match } });
  });

  if (Object.keys(sort).length) pipeline.push({ $sort: sort });

  if (select) {
    const selectFields = select.split(' ').reduce((acc, field) => {
      acc[field] = 1;
      return acc;
    }, {});
    pipeline.push({ $project: selectFields });
  }

  pipeline.push({ $skip: skip }, { $limit: limit });

  const result = await model.aggregate(pipeline).exec();
  const total = await model.countDocuments(filter);

  return {
    result,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
  };
};
