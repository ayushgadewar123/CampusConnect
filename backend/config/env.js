const REQUIRED = ["MONGO_URI", "JWT_SECRET"];

function validateEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    const error = new Error(
      `Missing required environment variables:\n- ${missing.join("\n- ")}\n\nCreate backend/.env from backend/.env.example and set valid values before starting the server.`
    );
    error.code = "MISSING_ENV";
    throw error;
  }

  return true;
}

// Optional runtime settings are read directly from process.env in the services layer.


module.exports = validateEnv;
