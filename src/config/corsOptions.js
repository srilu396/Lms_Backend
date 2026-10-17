const normalizeOrigin = (url) => {
  if (!url || typeof url !== 'string') return '';
  return url.trim().replace(/\/+$/, '');
};

const defaultOrigins = [
  'https://platform-course.vercel.app', // Production frontend
  'http://localhost:3000',              // Dev frontend (React/Next)
  'http://localhost:5173',              // Dev frontend (Vite)
];

const allowedOrigins = defaultOrigins.map(normalizeOrigin);

// If ALLOWED_ORIGINS is defined (comma-separated), add them
if (process.env.ALLOWED_ORIGINS) {
  const envOrigins = process.env.ALLOWED_ORIGINS
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);
  envOrigins.forEach((origin) => {
    if (!allowedOrigins.includes(origin)) {
      allowedOrigins.push(origin);
    }
  });
}

// If FRONTEND_URL is defined, add it as well
if (process.env.FRONTEND_URL) {
  const frontendOrigin = normalizeOrigin(process.env.FRONTEND_URL);
  if (frontendOrigin && !allowedOrigins.includes(frontendOrigin)) {
    allowedOrigins.push(frontendOrigin);
  }
}

const isOriginAllowed = (origin) => {
  if (!origin) return true; // Allow requests with no origin (curl, mobile, Postman)
  const cleanOrigin = normalizeOrigin(origin);
  if (allowedOrigins.includes(cleanOrigin)) return true;
  // Automatically permit all Vercel deployment and preview URLs
  if (/^https:\/\/.*\.vercel\.app$/.test(cleanOrigin)) return true;
  return false;
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      // In development, be lenient; in production, cleanly disallow without crashing
      if (process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(null, false);
      }
    }
  },
  credentials: true, // Required for cookies, authorization headers with HTTPS
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma'
  ],
  optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
};

module.exports = corsOptions;

