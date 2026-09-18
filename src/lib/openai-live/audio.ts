/**
 * Audio utilities for the conversation page.
 */

// Safely request microphone stream with multiple fallback strategies
export async function getAudioStream(): Promise<MediaStream | null> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    console.warn("getUserMedia not available in this browser/context");
    return null;
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch (err: unknown) {
    console.warn("Preferred audio constraints failed, trying basic audio stream:", err);
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (fallbackErr: unknown) {
      // Provide specific error messages for common mobile issues
      const error = fallbackErr as { name?: string; message?: string };
      if (error.name === "NotAllowedError") {
        throw new Error(
          "Microphone permission denied. Please allow microphone access in your browser settings and reload the page."
        );
      } else if (error.name === "NotFoundError") {
        throw new Error(
          "No microphone found on this device."
        );
      } else if (error.name === "NotReadableError") {
        throw new Error(
          "Microphone is in use by another app. Please close other apps using the mic and try again."
        );
      }
      console.warn("Microphone not available on this system:", fallbackErr);
      return null;
    }
  }
}
