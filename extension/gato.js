const video = document.querySelector("#gatoVideo");

video.play().catch(() => {
  video.controls = true;
});
