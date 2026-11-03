/**
 * Reading sounds, synthesized with Web Audio (no assets): short noise bursts
 * through a sweeping band-pass filter. The AudioContext is created on first
 * use, which is always inside a key press, so autoplay policies allow it.
 *
 * - Page turn: a bright upward rustle, like a page brushing past.
 * - Screen slide (within a page): quieter, lower and smoother, like paper
 *   sliding under the hand; sweeps down when reading on, up when reading back.
 */

type Swoosh = {
  durationS: number;
  volume: number;
  /** Band-pass centre at start and end, Hz. */
  fromHz: number;
  toHz: number;
  /** Band-pass Q: higher is a narrower, more tonal sound. */
  q: number;
  attackS: number;
};

const PAGE_TURN: Swoosh = { durationS: 0.28, volume: 0.12, fromHz: 900, toHz: 3500, q: 0.8, attackS: 0.04 };
const SLIDE: Omit<Swoosh, "fromHz" | "toHz"> = { durationS: 0.22, volume: 0.05, q: 1.2, attackS: 0.08 };
const SLIDE_HIGH_HZ = 1400;
const SLIDE_LOW_HZ = 500;

export function playPageTurn(): void {
  play(PAGE_TURN);
}

/** `direction`: 1 reading on (down), -1 reading back (up). */
export function playScreenSlide(direction: 1 | -1): void {
  const [fromHz, toHz] = direction > 0 ? [SLIDE_HIGH_HZ, SLIDE_LOW_HZ] : [SLIDE_LOW_HZ, SLIDE_HIGH_HZ];
  play({ ...SLIDE, fromHz, toHz });
}

let ctx: AudioContext | null = null;
/** One second of white noise, reused by every sound (each plays a slice). */
let noise: AudioBuffer | null = null;
const NOISE_S = 1;

function play(s: Swoosh): void {
  if (s.durationS > NOISE_S) throw new RangeError(`Sound longer than ${NOISE_S}s noise buffer`);
  ctx ??= new AudioContext();
  noise ??= whiteNoise(ctx, NOISE_S);
  const t = ctx.currentTime;

  const source = ctx.createBufferSource();
  source.buffer = noise;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = s.q;
  filter.frequency.setValueAtTime(s.fromHz, t);
  filter.frequency.exponentialRampToValueAtTime(s.toHz, t + s.durationS);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(s.volume, t + s.attackS);
  gain.gain.exponentialRampToValueAtTime(0.001, t + s.durationS);

  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(t);
  source.stop(t + s.durationS);
}

function whiteNoise(audio: AudioContext, seconds: number): AudioBuffer {
  const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * seconds), audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}
