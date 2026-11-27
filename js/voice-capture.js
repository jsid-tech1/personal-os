/* Capture one channel without sending microphone audio to the speakers. */
class PersonalVoice extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = new Float32Array(1024);
    this.used = 0;
  }

  process(inputs) {
    const frames = inputs[0]?.[0];
    if (frames) {
      for (const frame of frames) {
        this.samples[this.used++] = frame;
        if (this.used === this.samples.length) {
          this.port.postMessage(this.samples, [this.samples.buffer]);
          this.samples = new Float32Array(1024);
          this.used = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor("pos-voice", PersonalVoice);
