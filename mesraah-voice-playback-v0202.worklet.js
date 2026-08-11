class MesraahVoicePlayback0202 extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];
    this.offset = 0;
    this.buffered = 0;
    this.started = false;
    this.startBuffer = 1920;
    this.port.onmessage = event => {
      if (event.data?.type === 'clear') {
        this.queue = [];
        this.offset = 0;
        this.buffered = 0;
        this.started = false;
        return;
      }
      const samples = event.data?.samples ?? event.data;
      if (samples instanceof Float32Array && samples.length) {
        this.queue.push(samples);
        this.buffered += samples.length;
      }
    };
  }

  process(inputs, outputs) {
    const channel = outputs[0]?.[0];
    if (!channel) return true;

    if (!this.started) {
      if (this.buffered < this.startBuffer) {
        channel.fill(0);
        return true;
      }
      this.started = true;
    }

    let outIndex = 0;
    while (outIndex < channel.length && this.queue.length) {
      const current = this.queue[0];
      const count = Math.min(channel.length - outIndex, current.length - this.offset);
      channel.set(current.subarray(this.offset, this.offset + count), outIndex);
      outIndex += count;
      this.offset += count;
      this.buffered = Math.max(0, this.buffered - count);
      if (this.offset >= current.length) {
        this.queue.shift();
        this.offset = 0;
      }
    }

    if (outIndex < channel.length) {
      channel.fill(0, outIndex);
      this.started = false;
    }
    return true;
  }
}

registerProcessor('mesraah-voice-playback-0202', MesraahVoicePlayback0202);
