/*
 * The sound of the voyage (cosmos.ts), made on the spot with Web Audio: exploration rather than dread. Warm major chords
 * drift from one to the next in a big reverb, with a bell ringing out now and then. Speed opens the chords up and
 * brings in an airy rush; the warp's punch, a ping, a scan and the wormhole each get a phrase of bells. Off until someone
 * asks for it, and it remembers.
 */

const KEY = "sky-sound";
const LOUDNESS = 0.32;
/** Over a held D, the lift to E is the sound of something wonderful coming into view. Then it opens out and comes home. */
const CHORDS = [
  [50, 57, 64, 66, 69],
  [50, 59, 64, 68, 71],
  [55, 62, 69, 71, 74],
  [47, 59, 66, 69, 74],
];
const CHORD_SECONDS = 14;
/** D major pentatonic, high up: no note of it can sound wrong over those chords. */
const SPARKLE = [74, 76, 78, 81, 83, 86, 88, 90];

const pitch = (note: number) => 440 * 2 ** ((note - 69) / 12);

type Rig = {
  ctx: AudioContext;
  master: GainNode;
  /** Where bells go: dry, into the echo, and into the reverb. */
  bells: GainNode;
  voices: OscillatorNode[];
  tone: BiquadFilterNode;
  rush: GainNode;
  rushTone: BiquadFilterNode;
  chord: number;
  nextChord: number;
  nextSparkle: number;
};

/** A long, soft room: decaying noise, which is all a reverb really is. */
function hall(ctx: AudioContext, seconds: number) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  const node = ctx.createConvolver();
  node.buffer = buffer;
  return node;
}

export class EngineSound {
  on = false;
  private rig: Rig | null = null;
  private gone = false;

  constructor() {
    try { this.on = localStorage.getItem(KEY) === "on"; } catch {}
  }

  /** At the start of a flight. A hold has already touched the page by now, so the browser allows it. */
  begin() {
    if (this.on) this.start();
  }

  toggle() {
    this.on = !this.on;
    try { localStorage.setItem(KEY, this.on ? "on" : "off"); } catch {}
    if (this.on) this.start();
    else this.fade();
  }

  private start() {
    if (this.gone) return;
    if (this.rig) {
      this.rig.ctx.resume().catch(() => {});
      this.rig.master.gain.setTargetAtTime(LOUDNESS, this.rig.ctx.currentTime, 0.4);
      return;
    }
    const Context = window.AudioContext as typeof AudioContext | undefined;
    if (!Context) return;
    const ctx = new Context();
    const now = ctx.currentTime;
    const limiter = ctx.createDynamicsCompressor();
    limiter.connect(ctx.destination);
    const master = ctx.createGain();
    master.gain.value = 0;
    master.gain.setTargetAtTime(LOUDNESS, now, 1);
    master.connect(limiter);
    const reverb = hall(ctx, 4.5);
    const wet = ctx.createGain();
    wet.gain.value = 0.9;
    reverb.connect(wet);
    wet.connect(master);

    // The chords: two slightly detuned voices to a note, which is what makes them shimmer.
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 700;
    tone.Q.value = 0.4;
    const pad = ctx.createGain();
    pad.gain.value = 0.055;
    tone.connect(pad);
    pad.connect(master);
    pad.connect(reverb);
    const voices: OscillatorNode[] = [];
    for (const note of CHORDS[0]) {
      for (const cents of [-5, 5]) {
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.value = pitch(note);
        osc.detune.value = cents;
        osc.connect(tone);
        osc.start();
        voices.push(osc);
      }
    }
    // Slow breathing, so the chords never sit still.
    const breath = ctx.createOscillator();
    breath.frequency.value = 0.07;
    const depth = ctx.createGain();
    depth.gain.value = 260;
    breath.connect(depth);
    depth.connect(tone.frequency);
    breath.start();

    // The rush of speed: filtered noise, high and airy, with nothing low in it to rumble.
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const samples = noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    const air = ctx.createBufferSource();
    air.buffer = noise;
    air.loop = true;
    const rushTone = ctx.createBiquadFilter();
    rushTone.type = "bandpass";
    rushTone.frequency.value = 900;
    rushTone.Q.value = 0.7;
    const rush = ctx.createGain();
    rush.gain.value = 0;
    air.connect(rushTone);
    rushTone.connect(rush);
    rush.connect(master);
    rush.connect(reverb);
    air.start();

    // Bells ring on in an echo that dulls as it repeats.
    const bells = ctx.createGain();
    const echo = ctx.createDelay(1);
    echo.delayTime.value = 0.44;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.42;
    const dull = ctx.createBiquadFilter();
    dull.type = "lowpass";
    dull.frequency.value = 2600;
    bells.connect(master);
    bells.connect(reverb);
    bells.connect(echo);
    echo.connect(dull);
    dull.connect(feedback);
    feedback.connect(echo);
    dull.connect(master);
    dull.connect(reverb);

    this.rig = { ctx, master, bells, voices, tone, rush, rushTone, chord: 0, nextChord: now + CHORD_SECONDS, nextSparkle: now + 2.5 };
  }

  /** Every frame: speed 0 → 1 of a full warp, and how far the warp has spooled, 0 → 1. */
  update(speed: number, spool: number) {
    const rig = this.rig;
    if (!rig || !this.on) return;
    const now = rig.ctx.currentTime;
    rig.tone.frequency.setTargetAtTime(700 + speed * 1500 + spool * 700, now, 0.3);
    rig.rush.gain.setTargetAtTime(speed * 0.035 + spool * 0.05, now, 0.12);
    rig.rushTone.frequency.setTargetAtTime(900 + speed * 1600 + spool * 3200, now, 0.1);
    if (now >= rig.nextChord) {
      rig.nextChord = now + CHORD_SECONDS;
      rig.chord = (rig.chord + 1) % CHORDS.length;
      // The notes lean over to the next chord, rather than changing.
      rig.voices.forEach((osc, i) => osc.frequency.setTargetAtTime(pitch(CHORDS[rig.chord][Math.floor(i / 2)]), now, 1.6));
    }
    if (now >= rig.nextSparkle) {
      rig.nextSparkle = now + (2.5 + Math.random() * 4) / (1 + speed);
      this.bell(SPARKLE[Math.floor(Math.random() * SPARKLE.length)], 0, 0.05, 2.6);
    }
  }

  /** One soft bell: a pure note with a little of its octave, gone over a few seconds. */
  private bell(note: number, after: number, level: number, decay: number) {
    const rig = this.rig;
    if (!rig || !this.on) return;
    const at = rig.ctx.currentTime + after;
    const gain = rig.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(level, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    gain.connect(rig.bells);
    for (const [ratio, share] of [[1, 1], [2, 0.22]]) {
      const osc = rig.ctx.createOscillator();
      const part = rig.ctx.createGain();
      osc.frequency.value = pitch(note) * ratio;
      part.gain.value = share;
      osc.connect(part);
      part.connect(gain);
      osc.start(at);
      osc.stop(at + decay + 0.05);
    }
  }

  private phrase(notes: number[], gap: number, level: number, decay: number) {
    notes.forEach((note, i) => this.bell(note, i * gap, level, decay));
  }

  /** The warp catches: a quick run upward. */
  punch() {
    this.phrase([69, 74, 78, 81, 86], 0.055, 0.1, 2.4);
  }

  /** A tap on empty sky: one clear note, with the echo answering it. */
  ping() {
    this.bell(86, 0, 0.13, 2);
  }

  /** The scanner has something: two quick rising notes. */
  scan() {
    this.phrase([81, 88], 0.09, 0.08, 1.2);
  }

  /** Through the wormhole: the whole scale, climbing out of sight. */
  through() {
    this.phrase([62, 66, 69, 74, 78, 81, 86, 90, 93], 0.1, 0.11, 3.2);
  }

  /** You've reached somewhere: the same climb as the punch, slowed right down. */
  arrive() {
    this.phrase([62, 69, 74, 78, 81, 88], 0.28, 0.1, 4);
  }

  /** Quiet, for landing, arriving or being switched off. */
  fade() {
    this.rig?.master.gain.setTargetAtTime(0, this.rig.ctx.currentTime, 0.3);
  }

  /** The tab went out of sight: it shouldn't go on playing to itself. */
  pause(hidden: boolean) {
    if (!this.rig) return;
    if (hidden) this.rig.ctx.suspend().catch(() => {});
    else if (this.on) this.rig.ctx.resume().catch(() => {});
  }

  close() {
    this.gone = true;
    this.rig?.ctx.close().catch(() => {});
    this.rig = null;
  }
}
