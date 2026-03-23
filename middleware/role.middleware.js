function isInstructor(req, res, next) {
  if (!req.user || !["instructor", "admin"].includes(req.user.role)) {
    return res.status(403).json({
      error: "Instructor or Admin access required"
    });
  }
  next();
}

function allowInstructor(req,res,next){

 if(req.user.role !== "instructor"){
   return res.status(403).json({
     error:"Instructor access only"
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

exports.isInstructor = (req, res, next) => {
  if (req.user.role === "instructor" || req.user.role === "admin") {
    return next();
  }
  return res.status(403).json({ error: "Instructor access only" });
};

exports.isAdminOnly = (req, res, next) => {
  if (req.user.role === "admin") {
    return next();
  }
  return res.status(403).json({ error: "Admin access only" });
};

module.exports = {
  allowInstructor,
  isInstructor,
  isAdminOnly
};