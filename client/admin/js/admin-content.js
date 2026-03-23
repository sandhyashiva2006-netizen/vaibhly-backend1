const token = localStorage.getItem("adminToken");
if (!token) window.location.href = "login.html";

async function uploadContent() {
  const formData = new FormData();
  formData.append("course_id", courseId.value);
  formData.append("title", title.value);
  formData.append("content_type", type.value);
  formData.append("file", file.files[0]);

  const res = await fetch("/api/content/admin/upload", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token
    },
    body: formData
  });

  if (!res.ok) {
  const err = await res.json();
  console.error(err);
  alert(err.error || "Upload failed");
  return;
}

  alert("Content uploaded successfully");
}
