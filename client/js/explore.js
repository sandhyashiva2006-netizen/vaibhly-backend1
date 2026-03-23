let offset = 0;
let loading = false;

async function loadFeed() {

  if (loading) return;
  loading = true;

  const container = document.getElementById("feed-container");
const currentUsername = localStorage.getItem("username");


  if (offset === 0) {
    container.innerHTML = "";
  }

  try {

    const token = localStorage.getItem("token");

    const response = await fetch(`/api/feed?offset=${offset}`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    const posts = await response.json();

    if (posts.length === 0 && offset === 0) {
      container.innerHTML = `
        <div style="text-align:center; margin-top:40px;">
          <h3>No posts yet</h3>
          <p>Start engaging with the community.</p>
        </div>
      `;
      loading = false;
      return;
    }

    posts.forEach(post => {

      const postId = post.id;

      const card = document.createElement("div");
      card.classList.add("post-card");

      card.innerHTML = `
        <div class="post-header">
          <div>
            <strong>${post.username}</strong>
            <small>${formatTime(post.created_at)}</small>
          </div>

          <button class="follow-btn"
                  data-username="${post.username}">
            Follow
          </button>
        </div>

        <h3>${post.title}</h3>
        <p>${post.content.substring(0,150)}...</p>

        <button class="like-btn" data-id="${post.id}">
          ❤️ <span>${post.likes}</span>
        </button>

        <button class="toggle-comments" data-post="${post.id}">
          View comments (${post.comment_count || 0})
        </button>

        <div class="comments-wrapper" id="wrapper-${post.id}" style="display:none;">
          <div class="comments" id="comments-${post.id}"></div>

          <input type="text"
                 class="comment-input"
                 data-post="${post.id}"
                 placeholder="Write a comment..." />
        </div>
      `;

      container.appendChild(card);

    });

    offset += 10;

  } catch (error) {
    console.error("Error loading feed:", error);
  }

  loading = false;
}


// LIKE TOGGLE
document.addEventListener("click", async (e) => {

  const btn = e.target.closest(".like-btn");
  if (!btn) return;

  const postId = btn.dataset.id;
  const token = localStorage.getItem("token");

  const res = await fetch(`/api/posts/${postId}/like`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });

  const data = await res.json();

  if (!res.ok) return;

  const countSpan = btn.querySelector("span");
  let count = parseInt(countSpan.innerText);

  if (data.liked) {
    countSpan.innerText = count + 1;
    btn.classList.add("liked");
  }

  if (data.unliked) {
    countSpan.innerText = count - 1;
    btn.classList.remove("liked");
  }

});

document.addEventListener("click", async (e) => {

  const followBtn = e.target.closest(".follow-btn");
  if (!followBtn) return;

  const username = followBtn.dataset.username;
  const token = localStorage.getItem("token");

  try {

    // Get user ID
    const userRes = await fetch(`/api/profile/${username}`);
    const userData = await userRes.json();

    const targetUserId = userData.user.id;

    const res = await fetch(`/api/users/${targetUserId}/follow`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    const data = await res.json();

    if (data.followed) {
      followBtn.innerText = "Following";
      followBtn.classList.add("following");
    }

    if (data.unfollowed) {
      followBtn.innerText = "Follow";
      followBtn.classList.remove("following");
    }

  } catch (err) {
    console.error("Follow error:", err);
  }

});


// COMMENT SUBMIT
document.addEventListener("keypress", async (e) => {

  const token = localStorage.getItem("token");

  // Top-level comment
  if (e.target.classList.contains("comment-input") && e.key === "Enter") {

    const postId = e.target.dataset.post;
    const content = e.target.value.trim();
    if (!content) return;

    await fetch(`/api/posts/${postId}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ content })
    });

    e.target.value = "";
    loadComments(postId);
  }

  // Reply
  if (e.target.classList.contains("reply-input") && e.key === "Enter") {

    const postId = e.target.dataset.post;
    const parentId = e.target.dataset.parent;
    const content = e.target.value.trim();
    if (!content) return;

    await fetch(`/api/posts/${postId}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        content,
        parentId
      })
    });

    loadComments(postId);
  }

});

document.addEventListener("click", async (e) => {

  const toggleBtn = e.target.closest(".toggle-comments");
  if (!toggleBtn) return;

  const postId = toggleBtn.dataset.post;
  const wrapper = document.getElementById(`wrapper-${postId}`);

  // Extract current count from button text
  const match = toggleBtn.innerText.match(/\((\d+)\)/);
  const count = match ? match[1] : 0;

  if (wrapper.style.display === "none") {

    wrapper.style.display = "block";
    toggleBtn.innerText = `Hide comments (${count})`;
    loadComments(postId);

  } else {

    wrapper.style.display = "none";
    toggleBtn.innerText = `View comments (${count})`;

  }

});


document.addEventListener("click", (e) => {

  const replyBtn = e.target.closest(".reply-btn");
  if (!replyBtn) return;

  const commentId = replyBtn.dataset.id;
  const postId = replyBtn.dataset.post;

  const replyBox = replyBtn.parentElement.querySelector(".reply-box");

  if (replyBox.innerHTML !== "") {
    replyBox.innerHTML = "";
    return;
  }

  replyBox.innerHTML = `
    <input type="text"
           class="reply-input"
           data-post="${postId}"
           data-parent="${commentId}"
           placeholder="Write a reply..." />
  `;
});

// LOAD COMMENTS
async function loadComments(postId) {

  const res = await fetch(`/api/posts/${postId}/comments`);
  const comments = await res.json();

  const container = document.getElementById(`comments-${postId}`);
  container.innerHTML = "";

  const commentMap = {};

  comments.forEach(c => {
    c.children = [];
    commentMap[c.id] = c;
  });

  comments.forEach(c => {
    if (c.parent_id) {
      commentMap[c.parent_id]?.children.push(c);
    }
  });

  comments
    .filter(c => !c.parent_id)
    .forEach(c => renderComment(c, container, postId));
}

async function updateCommentCount(postId) {

  const res = await fetch(`/api/posts/${postId}/comments`);
  const comments = await res.json();

  const count = comments.length;

  const toggleBtn = document.querySelector(
    `.toggle-comments[data-post="${postId}"]`
  );

  if (!toggleBtn) return;

  const wrapper = document.getElementById(`wrapper-${postId}`);
  const isOpen = wrapper.style.display === "block";

  toggleBtn.innerText = isOpen
    ? `Hide comments (${count})`
    : `View comments (${count})`;
}

// RENDER COMMENT RECURSIVE
function renderComment(comment, parentElement, postId) {

  const div = document.createElement("div");
  div.classList.add("comment");

  div.innerHTML = `
    <strong>${comment.username}</strong>
    <p>${comment.content}</p>
    <small>${formatTime(comment.created_at)}</small>
    <button class="reply-btn"
            data-id="${comment.id}"
            data-post="${postId}">
      Reply
    </button>
    <div class="reply-box"></div>
    <div class="replies"></div>
  `;

  parentElement.appendChild(div);

  const repliesContainer = div.querySelector(".replies");

  comment.children.forEach(child => {
    renderComment(child, repliesContainer, postId);
  });
}


// TIME FORMAT
function formatTime(dateString) {
  const date = new Date(dateString);
  const diff = (Date.now() - date) / 1000;

  if (diff < 60) return "Just now";
  if (diff < 3600) return Math.floor(diff / 60) + " min ago";
  if (diff < 86400) return Math.floor(diff / 3600) + " hrs ago";
  return Math.floor(diff / 86400) + " days ago";
}


// INFINITE SCROLL
window.addEventListener("scroll", () => {
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 200) {
    loadFeed();
  }
});


// INITIAL LOAD
loadFeed();
