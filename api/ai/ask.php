<?php
header("Content-Type: application/json");

require_once "../../config/db.php"; // your DB connection

$data = json_decode(file_get_contents("php://input"), true);

$user_id   = intval($data['user_id']);
$course_id = intval($data['course_id']);
$lesson_id = intval($data['lesson_id']);
$question  = trim($data['question']);

if (!$question) {
  echo json_encode(["error" => "Empty question"]);
  exit;
}

/* 1️⃣ Get lesson content */
$stmt = $conn->prepare("SELECT content FROM lessons WHERE id = ?");
$stmt->bind_param("i", $lesson_id);
$stmt->execute();
$result = $stmt->get_result();
$lesson = $result->fetch_assoc();

if (!$lesson) {
  echo json_encode(["error" => "Lesson not found"]);
  exit;
}

$lessonContent = $lesson['content'];

/* 2️⃣ AI Prompt */
$systemPrompt = "You are EduNexa AI Tutor.
Answer ONLY using the lesson content.
If question is outside lesson, say:
'I can help only with this lesson content.'";

$userPrompt = "Lesson Content:\n$lessonContent\n\nStudent Question:\n$question";

/* 3️⃣ Call OpenAI */
$apiKey = "YOUR_OPENAI_KEY";

$payload = [
  "model" => "gpt-4.1-mini",
  "messages" => [
    ["role" => "system", "content" => $systemPrompt],
    ["role" => "user", "content" => $userPrompt]
  ]
];

$ch = curl_init("https://api.openai.com/v1/chat/completions");
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => [
    "Authorization: Bearer $apiKey",
    "Content-Type: application/json"
  ],
  CURLOPT_POSTFIELDS => json_encode($payload)
]);

$response = curl_exec($ch);
curl_close($ch);

$data = json_decode($response, true);
$answer = $data['choices'][0]['message']['content'] ?? "No response";

/* 4️⃣ Save to DB */
$stmt = $conn->prepare(
  "INSERT INTO ai_chats (user_id, course_id, lesson_id, question, answer)
   VALUES (?, ?, ?, ?, ?)"
);
$stmt->bind_param("iiiss", $user_id, $course_id, $lesson_id, $question, $answer);
$stmt->execute();

/* 5️⃣ Return answer */
echo json_encode(["answer" => $answer]);
