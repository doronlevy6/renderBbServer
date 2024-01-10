const jwt = require("jsonwebtoken");
const verifyToken = (req, res, next) => {
  const header = req.headers["authorization"];

  // Token is expected in the Authorization header

  if (!header) {
    return res.status(403).send("A token is required for authentication");
  }
  const bearer = header.split(" ");
  const token = bearer[1];

  try {
    const decoded = jwt.verify(token, "Avinoamyakar");
    req.user = decoded;
  } catch (err) {
    if (err.message.includes("expired")) {
      return res.status(401).send(" Token expired");
    } else return res.status(401).send("Invalid Token");
  }
  return next();
};

module.exports = { verifyToken };
