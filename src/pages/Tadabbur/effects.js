export const defaults = {
  background: 'none', brightness: 100, filter: 'none', mirror: true, cameraOff: false, autoFrame: false,
  microphone: '', speaker: '', noise: 'standard', echo: true, autoVolume: true
};

export function audioConstraints(settings) {
  return {
    deviceId: settings.microphone || undefined,
    noiseSuppression: settings.noise !== 'off',
    echoCancellation: settings.echo,
    autoGainControl: settings.autoVolume
  };
}

export const photoFilter = settings => `brightness(${settings.brightness}%) ${{
  none: '', soft: 'contrast(.87) saturate(.91)', warm: 'sepia(.26) saturate(1.17)',
  cool: 'sepia(.16) hue-rotate(170deg) saturate(.9)', mono: 'grayscale(1)'
}[settings.filter] || ''}`.trim();

function canvas(width, height) {
  return Object.assign(document.createElement('canvas'), { width, height });
}

async function loadSegmenter() {
  const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision');
  const files = await FilesetResolver.forVisionTasks('/tadabbur/wasm');
  return ImageSegmenter.createFromOptions(files, {
    baseOptions: { modelAssetPath: '/tadabbur/selfie_segmenter.tflite', delegate: 'CPU' },
    runningMode: 'VIDEO', outputCategoryMask: false, outputConfidenceMasks: true
  });
}

export function cameraCrop(box, width, height, face = false) {
  if (!box || !width || !height) return [0, 0, width, height];
  const factor = face ? 3.3 : 1.48;
  const cropWidth = Math.max(width * .48, Math.min(width, Math.max(box.width * factor, box.height * (face ? 3 : 1.05) * width / height)));
  const cropHeight = cropWidth * height / width;
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height * (face ? 1.05 : .39);
  return [Math.min(width - cropWidth, Math.max(0, centerX - cropWidth / 2)),
    Math.min(height - cropHeight, Math.max(0, centerY - cropHeight * .42)), cropWidth, cropHeight];
}

export function cameraProcessor(initialSettings, { preview = false, onError = () => {} } = {}) {
  let video, segmenter, timer, generation = 0;
  let settings = initialSettings;
  const output = canvas(640, 360);
  const ctx = output.getContext('2d');
  const foreground = canvas(640, 360);
  const fctx = foreground.getContext('2d');
  const mask = canvas(1, 1);
  const mctx = mask.getContext('2d');
  const processor = {
    name: 'mauiza-camera',
    canvas: output,
    update(values) { settings = values; },
    async init({ track }) {
      const current = ++generation;
      if (settings.background !== 'none' || settings.autoFrame) {
        const model = await loadSegmenter();
        if (current !== generation) { model.close(); return; }
        segmenter = model;
      }
      video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = new MediaStream([track]);
      try { await video.play(); } catch (error) { await processor.destroy(); throw error; }
      if (current !== generation) return;
      const ratio = video.videoWidth / video.videoHeight || 16 / 9;
      output.height = foreground.height = Math.max(1, Math.round(640 / ratio));
      const width = output.width, height = output.height;

      let smoothed = [0, 0, video.videoWidth, video.videoHeight];
      let faceBox;
      let detecting = false, lastDetection = 0;
      let detector;
      if (settings.autoFrame && typeof globalThis.FaceDetector === 'function') {
        try { detector = new globalThis.FaceDetector({ fastMode: true, maxDetectedFaces: 2 }); } catch {}
      }
      const confidenceAlpha = value => Math.round(Math.max(0, Math.min(1, (value - .19) / .62)) * 255);
      let pixels, opacity;
      let lastVideoTime = -1;
      function paint() {
        if (!video?.videoWidth) return;
        ctx.filter = photoFilter(settings);
        if (!segmenter) { ctx.drawImage(video, 0, 0, width, height); return; }

        if (video.currentTime === lastVideoTime) return;
        lastVideoTime = video.currentTime;
        const now = performance.now();
        if (detector && !detecting && now - lastDetection > 360) {
          detecting = true;
          lastDetection = now;
          detector.detect(video).then(faces => { faceBox = faces.length === 1 ? faces[0].boundingBox : null; })
            .catch(() => { detector = undefined; faceBox = null; }).finally(() => { detecting = false; });
        }
        segmenter.segmentForVideo(video, now, result => {
          const person = result.confidenceMasks?.at(-1);
          if (!person) { ctx.drawImage(video, 0, 0, width, height); return; }
          const data = person.getAsFloat32Array();
          if (mask.width !== person.width || mask.height !== person.height) {
            mask.width = person.width; mask.height = person.height;
            pixels = undefined;
          }
          if (!pixels) {
            pixels = mctx.createImageData(mask.width, mask.height);
            opacity = new Float32Array(data.length).fill(-1);
          }
          let minX = mask.width, minY = mask.height, maxX = -1, maxY = -1, count = 0;
          for (let i = 0; i < data.length; ++i) {
            const confidence = data[i];
            const previous = opacity[i];
            // Damp small edge flicker but follow deliberate motion quickly.
            opacity[i] = previous < 0 ? confidence : previous + (confidence - previous) * (Math.abs(previous - confidence) > .35 ? .9 : .55);
            pixels.data[i * 4 + 3] = confidenceAlpha(opacity[i]);
            if (settings.autoFrame && confidence > .8) {
              const x = i % mask.width, y = Math.floor(i / mask.width);
              minX = Math.min(minX, x); minY = Math.min(minY, y);
              maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); count++;
            }
          }
          mctx.putImageData(pixels, 0, 0);
          const vw = video.videoWidth, vh = video.videoHeight;
          const subject = count > data.length * .005 ? { x: minX * vw / mask.width, y: minY * vh / mask.height, width: (maxX - minX + 1) * vw / mask.width, height: (maxY - minY + 1) * vh / mask.height } : null;
          const target = cameraCrop(settings.autoFrame ? faceBox || subject : null, vw, vh, Boolean(faceBox));
          smoothed = smoothed.map((value, i) => value + (target[i] - value) * .16);
          function draw(targetContext, source, pad = 0) {
            const sx = source === mask ? mask.width / vw : 1;
            const sy = source === mask ? mask.height / vh : 1;
            const [x, y, w, h] = smoothed;
            targetContext.drawImage(source, x * sx, y * sy, w * sx, h * sy, -pad, -pad, width + 2 * pad, height + 2 * pad);
          }
          if (settings.background === 'none') { draw(ctx, video); return; }
          if (settings.background === 'green') {
            ctx.filter = 'none';
            ctx.fillStyle = '#168653';
            ctx.fillRect(0, 0, width, height);
          } else {
            const blur = settings.background === 'strong' ? 24 : 10;
            ctx.filter = photoFilter(settings) + ` blur(${blur}px)`;
            draw(ctx, video, blur * 1.25);
          }
          ctx.filter = 'none';
          fctx.clearRect(0, 0, width, height);
          fctx.filter = photoFilter(settings);
          draw(fctx, video);
          fctx.filter = 'none';
          fctx.globalCompositeOperation = 'destination-in';
          fctx.filter = 'blur(1px)';
          draw(fctx, mask);
          fctx.filter = 'none';
          fctx.globalCompositeOperation = 'source-over';
          ctx.drawImage(foreground, 0, 0);
        });
      }
      try { paint(); } catch (error) { await processor.destroy(); throw error; }
      timer = setInterval(() => {
        try { paint(); }
        catch (error) { clearInterval(timer); onError(error); }
      }, 40);
      if (!preview) {
        if (!output.captureStream) { await processor.destroy(); throw new Error('Video effects require canvas capture support.'); }
        processor.processedTrack = output.captureStream(25).getVideoTracks()[0];
      }
    },
    async restart(options) { await processor.destroy(); await processor.init(options); },
    async destroy() {
      generation++;
      clearInterval(timer);
      processor.processedTrack?.stop();
      processor.processedTrack = undefined;
      if (video) { video.pause(); video.srcObject = null; video = null; }
      segmenter?.close();
      segmenter = undefined;
    }
  };
  return processor;
}

export function strongNoiseProcessor() {
  let source, highPass, gate, output;
  const processor = {
    name: 'mauiza-strong-noise',
    async init({ track, audioContext }) {
      if (!audioContext?.audioWorklet) throw new Error('Strong noise cancellation requires AudioWorklet support.');
      await audioContext.audioWorklet.addModule('/tadabbur/noise-gate.js');
      source = audioContext.createMediaStreamSource(new MediaStream([track]));
      highPass = audioContext.createBiquadFilter();
      highPass.type = 'highpass'; highPass.frequency.value = 105;
      gate = new AudioWorkletNode(audioContext, 'mauiza-noise-gate');
      output = audioContext.createMediaStreamDestination();
      source.connect(highPass).connect(gate).connect(output);
      processor.processedTrack = output.stream.getAudioTracks()[0];
    },
    async restart(options) { await processor.destroy(); await processor.init(options); },
    async destroy() {
      [source, highPass, gate, output].forEach(node => node?.disconnect());
      processor.processedTrack?.stop();
    }
  };
  return processor;
}
