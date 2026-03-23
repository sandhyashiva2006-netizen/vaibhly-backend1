const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

if (!authHeader || !authHeader.startsWith("Bearer ")) {
  return res.status(401).json({ error: "No token" });
}

const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
};

// ✅ Allow only instructors
function isInstructor(req, res, next) {
  if (req.user.role !== "instructor") {
    return res.status(403).json({ error: "Instructor access only" });
  }
  next();
}

// ✅ Allow admin OR instructor
function isAdminOrInstructor(req, res, next) {
  if (!["admin", "instructor"].includes(req.user.role)) {
    return res.status(403).json({ error: "Admin or Instructor only" });
  }
  next();
}


module.exports = {
 verifyToken,
 isAdmin,
 isInstructor,
 isAdminOrInstructor
};
