async function createCompetitiveExam(){

 const title=document.getElementById("examTitle").value;
 const price=document.getElementById("examPrice").value;
 const passMarks=document.getElementById("passMarks").value;
 const totalQuestions=document.getElementById("totalQuestions").value;

 const res=await fetch("/api/admin/competitive-exams",{
  method:"POST",
  headers:{
   "Content-Type":"application/json",
   Authorization:"Bearer "+localStorage.getItem("token")
  },
  body:JSON.stringify({
   title,
   price,
   pass_marks:passMarks,
   total_questions:totalQuestions
  })
 });

 const data=await res.json();

 alert("Exam created successfully");

}