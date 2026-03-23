const params = new URLSearchParams(window.location.search);
const username = params.get("u");

async function loadFollowers() {

  const userRes = await fetch(`/api/profile/${username}`);
  const userData = await userRes.json();

  if (!userData.user) {
  console.error("User not found:", userData);
  return;
}

const userId = userData.user.id;


  const res = await fetch(`/api/users/${userId}/followers`);
  const followers = await res.json();

  const container = document.getElementById("followers-list");
  container.innerHTML = "";

  followers.forEach(user => {

    const div = document.createElement("div");

    div.innerHTML = `
      <p>
        <a href="/profile.html?u=${user.username}">
          ${user.username}
        </a>
      </p>
    `;

    container.appendChild(div);
  });

}

loadFollowers();
