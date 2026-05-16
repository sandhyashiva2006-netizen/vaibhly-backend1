function isInstructor(req, res, next) {
  if (!req.user || !["instructor", "admin"].includes(req.user.role)) {
    return res.status(403).json({
      error: "Instructor or Admin access required"
    });
  }
  next();
}

function allowInstructor(req, res, next) {
  if (!req.user || req.user.role !== "instructor") {
    return res.status(403).json({
      error: "Instructor access only"
    });
  }

  next();
}

function allowRecruiter(req, res, next) {
  if (!req.user || req.user.role !== "recruiter") {
    return res.status(403).json({
      error: "Recruiter access only"
    });
  }

  next();
}

function isAdminOnly(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      error: "Admin access required"
    });
  }
  next();
}

module.exports = {
  allowInstructor,
  allowRecruiter,
  isInstructor,
  isAdminOnly
};