class MesraahPCMPlaybackProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];
    this.offset = 0;
    this.port.onmessage = (event) => {
      if (event.data?.type === 'clear') {
        this.queue = [];
        this.offset = 0;
        return;
      }
      const payload = event.data?.samples ?? event.data;
      if (payload instanceof Float32Array && payload.length) {
        this.queue.push(payload);
      }
    };
  }

  process(inputs, outputs) {
    const output = outputs[0];
    if (!output?.length) return true;
    const channel = output[0];
    let outIndex = 0;

    while (outIndex < channel.length && this.queue.length) {
      const current = this.queue[0];
      if (!current?.length) {
        this.queue.shift();
        this.offset = 0;
        continue;
      }
      const availableOut = channel.length - outIndex;
      const availableIn = current.length - this.offset;
      const count = Math.min(availableOut, availableIn);
      channel.set(current.subarray(this.offset, this.offset + count), outIndex);
      outIndex += count;
      this.offset += count;
      if (this.offset >= current.length) {
        this.queue.shift();
        this.offset = 0;
      }
    }

    if (outIndex < channel.length) channel.fill(0, outIndex);
    return true;
  }
}

registerProcessor('mesraah-pcm-playback-v097', MesraahPCMPlaybackProcessor);
