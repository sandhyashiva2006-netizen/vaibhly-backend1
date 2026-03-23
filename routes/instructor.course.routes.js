const express = require("express");
const router = express.Router();

const pool = require("../config/db");
const { verifyToken } =
require("../middleware/auth.middleware");

const { allowInstructor } =
require("../middleware/role.middleware");


/* ================= CREATE COURSE ================= */

router.post(
"/instructor/courses",
verifyToken,
allowInstructor,
async(req,res)=>{

 const {title,price,description}
 = req.body;

 const result = await pool.query(`
 INSERT INTO courses
(title,price,description,instructor_id,created_by_role)
VALUES($1,$2,$3,$4,'instructor')
 RETURNING *
 `,
 [
  title,
  price,
  description,
  req.user.id
 ]);

 res.json(result.rows[0]);
});


/* ================= GET COURSES ================= */

router.get("/instructor/courses", verifyToken, allowInstructor, async (req, res) => {

  try {

    const instructorId = req.user.id;

const result = await pool.query(
  `SELECT * FROM courses 
   WHERE instructor_id = $1 
   AND created_by_role = 'instructor'`,
  [instructorId]
);


    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load courses" });
  }

});

module.exports = router;