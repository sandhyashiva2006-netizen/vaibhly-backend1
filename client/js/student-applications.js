async function loadApplications(){

const token = localStorage.getItem("token");

const res = await fetch("http://vaibhly-backend1.onrender.com/api/student/applications", {
headers: {
"Authorization": `Bearer ${token}`
}
});

const data = await res.json();

const container = document.getElementById("applicationsList");

container.innerHTML = "";

data.forEach(app => {

container.innerHTML += `
<div class="app-card">
<h4>${app.title}</h4>
<p>${app.company}</p>
<p>Status: Applied</p>
</div>
`;

});

}

loadApplications();