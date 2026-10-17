/**
 * Environment configuration validator.
 * Validates required environment variables for the application.
 * Logs safe, actionable error messages without exposing secret values.
 */

function validateEnv() {
  const isProduction = process.env.NODE_ENV === 'production';
  const missing = [];
  const warnings = [];

  // DATABASE_URL is required in all environments for database connection
  if (!process.env.DATABASE_URL) {
    if (isProduction) {
      missing.push('DATABASE_URL');
    } else {
      warnings.push('DATABASE_URL is not set. Database connections will fail without it.');
    }
  }

  // JWT Secrets are strictly required in production
  if (isProduction) {
    if (!process.env.JWT_ACCESS_SECRET) {
      missing.push('JWT_ACCESS_SECRET');
    }
    if (!process.env.JWT_REFRESH_SECRET) {
      missing.push('JWT_REFRESH_SECRET');
    }
  } else {
    if (!process.env.JWT_ACCESS_SECRET) {
      warnings.push('JWT_ACCESS_SECRET is not set. Default development fallback secret will be used.');
    }
    if (!process.env.JWT_REFRESH_SECRET) {
      warnings.push('JWT_REFRESH_SECRET is not set. Default development fallback secret will be used.');
    }
  }

  // Check PORT configuration
  if (process.env.PORT && isNaN(Number(process.env.PORT))) {
    warnings.push(`PORT "${process.env.PORT}" is not a valid number. Defaulting to 5000.`);
  }

  // Optional frontend CORS configs info
  if (!process.env.ALLOWED_ORIGINS && !process.env.FRONTEND_URL) {
    if (isProduction) {
      warnings.push('ALLOWED_ORIGINS or FRONTEND_URL not set. Defaulting to standard frontend origins and *.vercel.app.');
    }
  }

  // Output warnings
  warnings.forEach((msg) => console.warn(`[Config Warning] ${msg}`));

  // If required variables are missing in production, fail fast with clear explanation
  if (missing.length > 0) {
    const errorMsg = `[Config Error] Missing required environment variable(s): ${missing.join(', ')}. Please configure them in your Render dashboard under Environment variables.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  console.log(`[Config] Environment validated successfully for NODE_ENV=${process.env.NODE_ENV || 'development'}`);
}

module.exports = validateEnv;
