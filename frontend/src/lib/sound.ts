export type AlertPriority = 'critical' | 'high' | 'medium' | 'low';

export function playAlertChime(priority: AlertPriority) {
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    // Only trigger after user interaction to avoid autoplay block
    const ctx = new AudioCtx();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    gain.connect(ctx.destination);
    osc1.connect(gain);
    osc2.connect(gain);

    if (priority === 'critical') {
      osc1.frequency.value = 880;
      osc2.frequency.value = 440;
    } else if (priority === 'high') {
      osc1.frequency.value = 660;
      osc2.frequency.value = 330;
    } else if (priority === 'medium') {
      osc1.frequency.value = 440;
      osc2.frequency.value = 220;
    } else {
      osc1.frequency.value = 330;
      osc2.frequency.value = 165;
    }

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc1.start(ctx.currentTime);
    osc2.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.4);
    osc2.stop(ctx.currentTime + 0.4);
  } catch {
    // Silent fail if AudioContext unavailable
  }
}
