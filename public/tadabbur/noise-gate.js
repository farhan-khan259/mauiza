class MauizaNoiseGate extends AudioWorkletProcessor {
  constructor() {
    super();
    this.envelope = 0;
    this.gain = 0.12;
  }

  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    const output = outputs[0] || [];
    if (!input || !output.length) return true;
    for (let i = 0; i < input.length; i++) {
      this.envelope = Math.max(Math.abs(input[i]), this.envelope * 0.9995);
      const target = this.envelope > 0.016 ? 1 : 0.12;
      this.gain += (target - this.gain) * (target === 1 ? 0.045 : 0.0012);
      for (const channel of output) channel[i] = input[i] * this.gain;
    }
    return true;
  }
}
registerProcessor('mauiza-noise-gate', MauizaNoiseGate);
