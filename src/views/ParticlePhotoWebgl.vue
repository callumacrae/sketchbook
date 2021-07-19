<template>
  <div class="canvas-container">
    <canvas
      ref="canvas"
      @click="status = status === 'playing' ? 'paused' : 'playing'"
      @dragenter.prevent
      @dragleave.prevent
      @dragover.prevent
      @drop.prevent="handleDrop"
    ></canvas>
    <GlobalEvents target="window" @resize="setSize" />

    <div class="help-container" v-show="showHelp || showIosWarning">
      <div class="help" v-show="showIosWarning">
        <h2 style="color: red">WARNING</h2>
        <p>
          Due to a bug in how iOS handles webgl instancing, this animation
          performs incredibly poorly on iOS—to the point where it doesn't really
          work at all. On my phone, it runs at 0.0075 fps and makes my phone
          heat up to the temperature of the sun.
        </p>

        <p>
          I'd recommend trying this on desktop (it also just looks better), but
          if you really want to see what happens on iOS, you can
          <a
            href
            @click.prevent="
              showIosWarning = false;
              status = 'playing';
            "
          >
            proceed anyway</a
          >.
        </p>
      </div>
      <div class="help" v-show="showHelp">
        <h2>Instructions</h2>

        <p>
          This experiment visualises images as collections of animated coloured
          particles.
        </p>

        <p>
          In addition to providing a few images (selectable on the configuration
          in the top right of the screen), it also allows you to upload your own
          by dragging and dropping them onto the canvas.
        </p>

        <p>
          Through a bit of experimentation, I've found the following makes the
          best images:
        </p>

        <ul>
          <li>
            Lower resolution images or blurred images work better as it prevents
            the particles from changing size and colour too quickly as they move
            about. Most of the demo images are lower than 500px wide.
          </li>

          <li>
            Images with lots of contrast between lighter and darker areas make
            more effective graphics. Similarly, images where the details are on
            the lighter parts of the images and the backgrounds are dark also
            look better.
          </li>

          <li>
            Some images, especially images with finer details, look better with
            a high number of smaller points (adjust pointSizeMultiplier), while
            others look better with a low number of larger points.
          </li>
        </ul>

        <p>
          To export high quality videos from this you'll need to
          <a href="https://github.com/callumacrae/sketchbook">clone the repo</a>
          and look for the <code>this.record</code> call in
          ParticlePhotoWebgl.vue (or ask me for help on Twitter!)
        </p>
      </div>
    </div>

    <p
      class="status"
      v-show="status === 'paused' && !showIosWarning"
      @click="status = 'playing'"
    >
      paused, click to resume
    </p>

    <a
      v-if="!showIosWarning"
      class="toggle-help-link"
      href
      @click.prevent="showHelp = !showHelp"
    >
      toggle help
    </a>
  </div>
</template>

<script>
import fragmentShaderSource from './ParticlePhoto-fragment.glsl';
import vertexShaderSource from './ParticlePhoto-vertex.glsl';

import * as twgl from 'twgl.js/dist/4.x/twgl-full.module';
import * as dat from 'dat.gui';
import Stats from 'stats.js';

import recordMixin from '../mixins/record';
import * as random from '../utils/random';
random.setSeed('set seed');

const isAndroid = /android/i.test(navigator.userAgent);
const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isMobile = isAndroid || isIos;

const imageData = {
  sunset: {
    src:
      '/assets/particle-photos/leo-nagle-TLuNQu-5xP4-unsplash-small-blurred.jpg',
    ratio: 2 / 3,
    configPreset: {
      particles: isMobile ? 20e3 : 40e3,
      color: true,
      radiusValExponent: 1.5,
      alphaValMultiplier: 0.85,
      alphaValExponent: 1.2,
      pointSizeMultiplier: isMobile ? 20 : 10,
      twinkleFactor: 0
    }
  },
  woman: {
    src:
      '/assets/particle-photos/thea-hoyer-CrJyu9HoeBg-unsplash-small-blurred.jpg',
    ratio: 2 / 3,
    configPreset: {
      color: false,
      particles: 30e3,
      radiusValExponent: 2,
      alphaValExponent: 1.5,
      alphaValMultiplier: 0.85,
      pointSizeMultiplier: 10,
      twinkleFactor: 0
    }
  },
  zebra: {
    src:
      '/assets/particle-photos/frida-bredesen-c_cPNXlovvY-unsplash-small-blurred.png',
    ratio: 1,
    configPreset: {
      color: false,
      particles: 30e3,
      radiusValExponent: 2,
      alphaValExponent: 1.5,
      alphaValMultiplier: 1,
      pointSizeMultiplier: 10,
      twinkleFrequency: 12,
      twinkleIntensity: 25,
      twinkleFactor: 0.7
    }
  },
  'bucket hat': {
    src: '/assets/particle-photos/brandon-webb-FwjkcL9Hpx8-unsplash-small.jpg',
    ratio: 3 / 2,
    configPreset: {
      color: true,
      particles: 40e3,
      radiusValExponent: 0.7,
      alphaValExponent: 0.7,
      alphaValMultiplier: 1,
      pointSizeMultiplier: 7,
      twinkleFactor: 0
    }
  },
  rhino: {
    src: '/assets/particle-photos/rhino.jpeg',
    ratio: 422 / 222,
    configPreset: {
      particles: 50e3,
      radiusValExponent: 1.3,
      alphaValExponent: 0.1,
      alphaValMultiplier: 1,
      color: true,
      pointSizeMultiplier: 8,
      twinkleFactor: 0.8
    }
  }
};

export default {
  mixins: [recordMixin],
  data: () => {
    const image = 'rhino';

    return {
      status: 'playing',
      width: undefined,
      height: undefined,
      showHelp: false,
      showIosWarning: false,
      userTexture: undefined,
      config: {
        // Init config
        particles: 40e3,
        particleBaseSpeed: isMobile ? 8 : 5,

        // Shader config
        radiusValExponent: 1.5,
        alphaValExponent: 1.2,
        alphaValMultiplier: 0.85,
        color: true,
        xInNoiseMultiplier: 200, // Not user configurable, bit buggy
        xOutNoiseMultiplier: isMobile ? 0.4 : 0.2,
        yInNoiseMultiplier: 1234, // Not user configurable, pointless
        yOutNoiseMultiplier: isMobile ? 0.004 : 0.002,
        pointSizeMultiplier: 10,
        twinkleFrequency: 12,
        twinkleIntensity: 25,
        twinkleFactor: 0,

        image,
        ...imageData[image].configPreset
      }
    };
  },
  mounted() {
    this.setSize();
    this.init().then(() => {
      this.frame();

      if (false) {
        this.record({
          width: 1000,
          height: 1500,
          fps: 25,
          duration: 10e3,
          directory: 'particle-photo-sunset',
          background: 'black'
        });
      }
    });

    const gui = new dat.GUI();
    this.gui = gui;

    gui
      .add(this.config, 'image', Object.keys(imageData).concat('user'))
      .listen();
    gui.add(this.config, 'particles', 5000, 100000, 1000).listen();
    gui.add(this.config, 'particleBaseSpeed', 0, 50).listen();
    gui.add(this.config, 'radiusValExponent', 0.1, 10).listen();
    gui.add(this.config, 'alphaValExponent', 0.1, 10).listen();
    gui.add(this.config, 'alphaValMultiplier', 0.1, 1).listen();
    gui.add(this.config, 'color').listen();
    gui.add(this.config, 'xOutNoiseMultiplier', 0, 1).listen();
    gui.add(this.config, 'yOutNoiseMultiplier', 0, 0.1).listen();
    gui.add(this.config, 'pointSizeMultiplier', 1, 30).listen();
    gui.add(this.config, 'twinkleFrequency', 1, 50).listen();
    gui.add(this.config, 'twinkleIntensity', 1, 50).listen();
    gui.add(this.config, 'twinkleFactor', 0, 1).listen();

    this.stats = new Stats();
    this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(this.stats.dom);

    if (isIos) {
      this.status = 'paused';
      this.showIosWarning = true;
      gui.close();
    }
  },
  beforeDestroy() {
    cancelAnimationFrame(this.frameId);

    if (this.gui) {
      this.gui.destroy();
    }
    if (this.stats) {
      this.stats.dom.remove();
      delete this.stats;
    }
  },
  methods: {
    setSize() {
      const canvas = this.$refs.canvas;
      this.gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });

      this.dpr = window.devicePixelRatio;
      if (window.innerWidth < window.innerHeight * this.imageData.ratio) {
        this.width = window.innerWidth * this.dpr;
        this.height = (window.innerWidth / this.imageData.ratio) * this.dpr;
      } else {
        this.height = window.innerHeight * this.dpr;
        this.width = window.innerHeight * this.imageData.ratio * this.dpr;
      }

      canvas.width = this.width;
      canvas.height = this.height;
    },
    init() {
      const { gl, config } = this;

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      this.programInfo = twgl.createProgramInfo(gl, [
        vertexShaderSource,
        fragmentShaderSource
      ]);

      const particleData = {
        xs: [],
        initialOffsets: [],
        speeds: []
      };
      for (let i = 0; i < config.particles; i++) {
        particleData.xs.push(i / config.particles);
        particleData.initialOffsets.push(random.range(-1, 1));
        particleData.speeds.push(random.range(0, config.particleBaseSpeed));
      }

      this.particleData = particleData;

      twgl.setAttributePrefix('a_');
      this.bufferInfo = twgl.createBufferInfoFromArrays(gl, {
        x: {
          numComponents: 1,
          data: particleData.xs
        },
        initial_offset: {
          numComponents: 1,
          data: particleData.initialOffsets
        },
        speed: {
          numComponents: 1,
          data: particleData.speeds
        }
      });
      twgl.setBuffersAndAttributes(gl, this.programInfo, this.bufferInfo);

      if (this.images) {
        return Promise.resolve();
      }

      return new Promise(resolve => {
        // Use a blurred image instead of sampling an area of more than one pixel
        // in the fragment shader - do the work ahead of time!
        this.images = twgl.createTextures(gl, imageData, resolve);
      });
    },
    frame(timestamp = 0) {
      if (this.status !== 'recording') {
        this.frameId = requestAnimationFrame(this.frame);
      }

      if (this.status === 'paused') {
        return;
      }

      this.stats.begin();

      const { gl, programInfo, bufferInfo, width, height, config } = this;

      gl.viewport(0, 0, width, height);
      gl.useProgram(programInfo.program);
      gl.clear(gl.COLOR_BUFFER_BIT);

      const uniforms = {
        u_time: timestamp,
        u_image_texture:
          config.image === 'user'
            ? this.userTexture.texture
            : this.images[config.image],
        u_width: width,
        u_height: height,
        u_dpr: this.dpr,
        u_radius_val_exponent: config.radiusValExponent,
        u_alpha_val_exponent: config.alphaValExponent,
        u_alpha_val_multiplier: config.alphaValMultiplier,
        u_color: config.color,
        u_x_in_noise_multiplier: config.xInNoiseMultiplier,
        u_x_out_noise_multiplier: config.xOutNoiseMultiplier,
        u_y_in_noise_multiplier: config.yInNoiseMultiplier,
        u_y_out_noise_multiplier: config.yOutNoiseMultiplier,
        u_point_size_multiplier: config.pointSizeMultiplier,
        u_twinkle_frequency: config.twinkleFrequency,
        u_twinkle_intensity: config.twinkleIntensity,
        u_twinkle_factor: config.twinkleFactor
      };

      twgl.setUniforms(programInfo, uniforms);
      twgl.drawBufferInfo(gl, bufferInfo, gl.POINTS);

      this.stats.end();
    },
    handleDrop(e) {
      const image = e.dataTransfer.files[0];
      if (!image.type.startsWith('image/')) {
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const img = document.createElement('img');

        img.onload = () => {
          const texture = twgl.createTexture(this.gl, { src: img });
          this.userTexture = { texture, ratio: img.width / img.height };
          this.config.image = 'user';
          this.setSize();

          if (img.width > 500 && img.height > 500) {
            setTimeout(() => {
              alert(
                'Heads up, this works better with low resolution images: see the help for more info'
              );
            });
          }
        };

        img.src = reader.result;
      };
      reader.readAsDataURL(image);
    }
  },
  computed: {
    imageData() {
      return this.config.image === 'user'
        ? this.userTexture
        : imageData[this.config.image];
    }
  },
  watch: {
    'config.particles': 'init',
    'config.particleBaseSpeed': 'init',
    'config.image'(image, oldImage) {
      if (image === 'user' && !this.userTexture) {
        alert('Drag and drop an image onto this window to test your own image');
        this.config.image = oldImage;
        return;
      }

      this.setSize();

      if (this.imageData.configPreset) {
        for (let [key, value] of Object.entries(this.imageData.configPreset)) {
          this.config[key] = value;
        }
      }
    }
  }
};
</script>

<style scoped>
.canvas-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;

  font-family: sans-serif;

  background-color: black;
}

canvas {
  max-height: 100vh;
  max-width: 100vw;
}

.toggle-help-link {
  position: absolute;
  bottom: 10px;
  right: 10px;

  font-size: 12px;
  text-decoration: none;

  color: lightgrey;
}

.status {
  position: absolute;
  bottom: 10px;
  left: 10px;

  font-size: 12px;

  color: lightgrey;
}

.help-container {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  background-color: rgba(0, 0, 0, 0.4);
  color: white;
  backdrop-filter: blur(3px);
}

.help-container .help {
  width: 90%;
  max-width: 500px;
}

.help li {
  margin-bottom: 1em;
}

.help a {
  color: inherit;
}
</style>
