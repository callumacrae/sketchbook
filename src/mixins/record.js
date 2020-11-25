export default {
  methods: {
    record(options) {
      cancelAnimationFrame(this.frameId);
      this.status = 'recording';

      const canvas = this.ctx.canvas;

      this.width = options.width;
      this.height = options.height;
      canvas.width = options.width;
      canvas.height = options.height;

      const framesData = {};

      const frameDuration = 1e3 / options.fps;
      const frames = Math.round(options.duration / frameDuration);
      const framesNameLength = Math.ceil(Math.log10(frames));

      for (let i = 0; i < frames; i++) {
        const timestamp = i * frameDuration;
        this.frame(timestamp);
        const frameName = i.toString().padStart(framesNameLength, '0');
        framesData[frameName] = canvas.toDataURL('image/png');
      }

      fetch('http://localhost:3000/save-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ framesData, options })
      });

      this.status = 'playing';
      this.setSize();
      this.frame();
    }
  }
};
