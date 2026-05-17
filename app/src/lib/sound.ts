let audio: HTMLAudioElement | null = null;

export function playMessageSound() {
  try {
    if (!audio) audio = new Audio("/notification.mp3");
    audio.currentTime = 0;
    void audio.play();
  } catch {
    // autoplay blocked or file missing — fail silently
  }
}
