// ui-global.js

window.bindLogout = function (selector, redirectUrl) {
  const btn = document.querySelector(selector);
  if (!btn) return;

  btn.onclick = () => {
    localStorage.clear();
    window.location.href = redirectUrl;
  };
};
