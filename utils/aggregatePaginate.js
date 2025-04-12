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
    populate = [],
    additionalPipeline = [],
  } = aggregateOptions;

  const pipeline = [{ $match: filter }];

  populate.forEach((pop) => {
    if (!pop.from || !pop.localField || !pop.as) {
      throw new Error(
        "Missing required fields in populate options: 'from', 'localField', or 'as'."
      );
    }

    pipeline.push({
      $lookup: {
        from: pop.from,
        localField: pop.localField,
        foreignField: pop.foreignField || '_id',
        as: pop.as,
        pipeline: [
          ...(pop.match ? [{ $match: pop.match }] : []),
          ...(pop.select ? [{ $project: pop.select }] : []),
        ],
      },
    });

    if (pop.single)
      pipeline.push({
        $unwind: { path: `$${pop.as}`, preserveNullAndEmptyArrays: true },
      });
  });

  if (additionalPipeline.length > 0) {
    pipeline.push(...additionalPipeline);
  }

  if (Object.keys(sort).length) pipeline.push({ $sort: sort });

  pipeline.push(
    {
      $facet: {
        data: [{ $skip: skip }, { $limit: limit }],
        total: [{ $count: 'count' }],
      },
    },
    {
      $project: {
        data: 1,
        total: { $arrayElemAt: ['$total.count', 0] },
      },
    }
  );

  const [result] = await model.aggregate(pipeline).exec();

  return {
    result: result.data,
    totalPages: Math.ceil((result.total || 0) / limit),
    currentPage: page,
  };
};
