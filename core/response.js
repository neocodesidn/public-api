const CREATOR = "neovx";

export function ok(res, { source = null, data = null, meta = {} } = {}, status = 200) {
  return res.status(status).json({
    success: true,
    creator: CREATOR,
    ...(source ? { source } : {}),
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  });
}

export function fail(res, code, message, status = 500, details) {
  return res.status(status).json({
    success: false,
    creator: CREATOR,
    error: {
      code,
      message,
      ...(details ? { details } : {})
    }
  });
}
