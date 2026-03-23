const express = require("express");
const router = express.Router();
const pool = require("../db");

router.post("/add-question", async (req, res) => {

const {
course_id,
question,
option_a,
option_b,
option_c,
option_d,
correct_answer
} = req.body;

try {

await pool.query(
`INSERT INTO exam_questions
(course_id, question, option_a, option_b, option_c, option_d, correct_answer)
VALUES ($1,$2,$3,$4,$5,$6,$7)`,
[
course_id,
question,
option_a,
option_b,
option_c,
option_d,
correct_answer
]
);

res.json({
success: true,
message: "Question added"
});

} catch(err){
console.error(err);
res.status(500).json({error:"Server error"});
}

});

router.get("/course/:courseId", async (req,res)=>{

const {courseId} = req.params;

try{

const result = await pool.query(
"SELECT id,question,option_a,option_b,option_c,option_d FROM exam_questions WHERE course_id=$1",
[courseId]
);

res.json(result.rows);

}catch(err){
console.error(err);
res.status(500).json({error:"Server error"});
}

});

router.post("/submit", async (req,res)=>{

const {user_id, course_id, answers} = req.body;

try{

const questions = await pool.query(
"SELECT * FROM exam_questions WHERE course_id=$1",
[course_id]
);

let correct = 0;

for(const q of questions.rows){

const userAnswer = answers[q.id];

if(userAnswer === q.correct_answer){
correct++;
}

}

const total = questions.rows.length;

const score = Math.round((correct/total)*100);

const passed = score >= 60;

const attempt = await pool.query(
`INSERT INTO exam_attempts
(user_id, course_id, score, total_questions, passed)
VALUES ($1,$2,$3,$4,$5)
RETURNING id`,
[user_id,course_id,score,total,passed]
);

res.json({
score,
total,
passed
});

}catch(err){
console.error(err);
res.status(500).json({error:"Server error"});
}

});

module.exports = router;