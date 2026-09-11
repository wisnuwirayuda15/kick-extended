export function showToast(message, duration = 5000) {
  document.querySelector("#k-toast")?.remove();
  const toast = document.createElement("div");
  toast.id = "k-toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}
