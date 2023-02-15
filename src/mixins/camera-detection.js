import * as perf from '../utils/perf';

import backgroundImage from '../assets/projection-gravity/test-image-2.jpg';

const videoEl = document.createElement('video');
videoEl.setAttribute('autoplay', true);

export default {
  data: () => ({
    lastRefresh: Date.now(),
    detectionConfig: {
      platformOpacity: 1,
      useCamera: false,
      cameraIndex: 0,
      imageReduceFactor: 2,
      edgeThreshold: 0.5,
      minSize: 50e3,
      maxSize: 200e3,
      refreshPerSecond: 0,
      // The b values are more precise and just added to the other value by
      // the worker they're passed to
      transforms: {
        x1: 0,
        x1B: 0,
        y1: 0,
        y1B: 0,
        x2: 1,
        x2B: 0,
        y2: 0,
        y2B: 0,
        x3: 0,
        x3B: 0,
        y3: 1,
        y3B: 0,
        x4: 1,
        x4B: 0,
        y4: 1,
        y4B: 0,
      },
    },
  }),
  mounted() {
    this.contourWorker = new Worker(
      new URL('./camera-detection-worker.js', import.meta.url)
    );

    this.contourWorker.onmessage = (msg) => this.cameraDetectionUpdate(msg);

    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const cameras = devices.filter(({ kind }) => kind === 'videoinput');
      if (this._detectionGui && this._cameraController) {
        if (cameras.length === 1) {
          this._detectionGui.remove(this._cameraController);

          // Set to 0 in case something else is remembered
          this.config.cameraIndex = 0;
        } else {
          this._cameraController.max(cameras.length - 1);
        }
      } else {
        console.warn('Cameras setup before imgui setup');
      }

      this.cameras = cameras;
    });
  },
  beforeDestroy() {
    if (this.contourWorker) {
      this.contourWorker.terminate();
    }
  },
  methods: {
    setupDatGui(gui, guiFolder = gui) {
      this._detectionGui = guiFolder;
      const config = this.detectionConfig;

      gui.remember(config);
      gui.remember(config.transforms);

      guiFolder.add(config, 'platformOpacity', 0, 1);
      guiFolder.add(config, 'useCamera');
      this._cameraController = guiFolder.add(config, 'cameraIndex', 0, 3, 1);
      guiFolder.add(config, 'imageReduceFactor', 1, 32, 1);
      guiFolder.add(config, 'edgeThreshold', 0, 1);
      guiFolder.add(config, 'minSize', 0, 100e3);
      guiFolder.add(config, 'maxSize', 0, 400e3);
      guiFolder.add(config, 'refreshPerSecond', 0, 15, 1);
      guiFolder
        .add({ refresh: () => this.syncPlatforms(false) }, 'refresh')
        .name('Manually refresh image');

      guiFolder.add(config.transforms, 'x1', 0, 1);
      guiFolder.add(config.transforms, 'x1B', -0.01, 0.01);
      guiFolder.add(config.transforms, 'y1', 0, 1);
      guiFolder.add(config.transforms, 'y1B', -0.01, 0.01);
      guiFolder.add(config.transforms, 'x2', 0, 1);
      guiFolder.add(config.transforms, 'x2B', -0.01, 0.01);
      guiFolder.add(config.transforms, 'y2', 0, 1);
      guiFolder.add(config.transforms, 'y2B', -0.01, 0.01);
      guiFolder.add(config.transforms, 'x3', 0, 1);
      guiFolder.add(config.transforms, 'x3B', -0.01, 0.01);
      guiFolder.add(config.transforms, 'y3', 0, 1);
      guiFolder.add(config.transforms, 'y3B', -0.01, 0.01);
      guiFolder.add(config.transforms, 'x4', 0, 1);
      guiFolder.add(config.transforms, 'x4B', -0.01, 0.01);
      guiFolder.add(config.transforms, 'y4', 0, 1);
      guiFolder.add(config.transforms, 'y4B', -0.01, 0.01);
    },
    syncPlatforms(useCache = true, cacheCamera = true) {
      perf.start('sync platforms total');
      perf.start('syncPlatforms');

      const { _cachedImageData, detectionConfig: config } = this;

      // The cache is for when adjusting the transforms without reading the
      // image or video again
      if (
        _cachedImageData &&
        // If cache data has been moved to previous thread we can't use it
        _cachedImageData.data.buffer.byteLength &&
        useCache
      ) {
        this.platformsFromData(_cachedImageData);
      } else if (config.useCamera) {
        const readyFn = () => {
          const n = videoEl.width / config.imageReduceFactor;
          const m = videoEl.height / config.imageReduceFactor;

          const tmpCanvas = document.createElement('canvas');
          tmpCanvas.width = n;
          tmpCanvas.height = m;
          const ctx = tmpCanvas.getContext('2d');

          ctx.drawImage(videoEl, 0, 0, n, m);
          const data = ctx.getImageData(0, 0, n, m);

          this.platformsFromData(data, !!config.refreshPerSecond);

          this._cachedImageData = data;

          // Event might not be added, that's fine
          videoEl.removeEventListener('playing', readyFn);
        };

        if (cacheCamera && videoEl.readyState === 4) {
          readyFn();
        } else {
          const cameraId = this.cameras[config.cameraIndex].deviceId;
          navigator.mediaDevices
            .getUserMedia({ video: { deviceId: { exact: cameraId } } })
            .then((stream) => {
              videoEl.srcObject = stream;

              const track = stream.getVideoTracks()[0];

              const {
                width: { max: n },
                height: { max: m },
              } = track.getCapabilities();

              videoEl.width = n;
              videoEl.height = m;

              videoEl.addEventListener('playing', readyFn);
            });
        }
      } else {
        const imgEl = new Image();
        imgEl.onload = () => {
          const tmpCanvas = document.createElement('canvas');
          const n = imgEl.width / config.imageReduceFactor;
          const m = imgEl.height / config.imageReduceFactor;
          tmpCanvas.width = n;
          tmpCanvas.height = m;
          const ctx = tmpCanvas.getContext('2d');

          ctx.drawImage(imgEl, 0, 0, n, m);
          const data = ctx.getImageData(0, 0, n, m);

          this.platformsFromData(data, !!config.refreshPerSecond);

          this._cachedImageData = data;
        };
        imgEl.src = backgroundImage;
      }
      perf.end('syncPlatforms');
    },
    platformsFromData(data, move = false) {
      // This is too expensive to do on main thread while animation is running
      this.contourWorker.postMessage(
        {
          data: data.data.buffer,
          inWidth: data.width,
          inHeight: data.height,
          config: this.detectionConfig,
          outWidth: this.width,
          outHeight: this.height,
        },
        move ? undefined : [data.data.buffer]
      );
    },
    detectionFrame() {
      const { detectionConfig: config, lastRefresh } = this;

      if (
        config.refreshPerSecond &&
        Date.now() - lastRefresh > 1000 / config.refreshPerSecond
      ) {
        this.syncPlatforms(false);
        this.lastRefresh = Date.now();
      }
    },
  },
  watch: {
    'detectionConfig.transforms': {
      deep: true,
      handler: 'syncPlatforms',
    },
    'detectionConfig.useCamera'() {
      this.syncPlatforms(false);
    },
    'detectionConfig.imageReduceFactor'() {
      this.syncPlatforms(false);
    },
    'detectionConfig.cameraIndex'() {
      const camera = this.cameras[this.detectionConfig.cameraIndex];
      console.info(`Switching to camera: ${camera.label}`);
      this.syncPlatforms(false, false);
    },
    'detectionConfig.edgeThreshold': 'syncPlatforms',
    'detectionConfig.minSize': 'syncPlatforms',
    'detectionConfig.maxSize': 'syncPlatforms',
  },
};
