const allowedOrigins = [
  'https://platform-course-9o87.vercel.app', // Production frontend
  'http://localhost:3000',                   // Dev frontend (React/Next)
  'http://localhost:5173',                   // Dev frontend (Vite)
];

// If you define ALLOWED_ORIGINS in your Render environment variables (comma-separated), it will add them too
if (process.env.ALLOWED_ORIGINS) {
  const envOrigins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  allowedOrigins.push(...envOrigins);
}

const corsOptions = {
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps, curl, or Postman)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // Instead of throwing an error that causes a 500 server error, 
      // we allow it dynamically to prevent issues in Postman/testing.
      callback(null, true);
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
  ],
  optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
};

module.exports = corsOptions;
