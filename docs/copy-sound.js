(function() {
  const sound = new Audio('/sounds/copy.wav');
  sound.volume = 1;

  document.addEventListener('click', (e) => {
    const copyButton = e.target.closest('[aria-label="Copy"]') ||
                       e.target.closest('button[class*="copy"]');
    if (copyButton) {
      sound.currentTime = 0;
      sound.play().catch(() => {});
    }
  });
})();
