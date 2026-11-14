(() => {
  'use strict';
  const ns = globalThis.NocturneWeb = globalThis.NocturneWeb || {};
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  // v0.23.5: lightweight WebP assets already contain a natural forward loop.
  // Nocturne only controls playback tempo. There is no ping-pong, endpoint
  // hold, or one-shot mode anymore.
  const CHARACTER_CONFIG = {
    MUTE: {
      displayName: '뮤트',
      folders: ['characters/Mute'],
      motions: {
        normal:    { file:'normal',   durationScale:1.20 },
        thinking:  { file:'thinking', durationScale:1.30 },
        explain:   { file:'explain',  durationScale:1.30 },
        serious:   { file:'serious',  durationScale:1.30 },
        realize:   { file:'realize',  durationScale:1.50 },
        confused:  { file:'confused', durationScale:2.00 }
      }
    },
    ED: {
      displayName: '이드',
      folders: ['characters/Ed'],
      motions: {
        normal:     { file:'normal',    durationScale:1.00 },
        curious:    { file:'curious',   durationScale:1.00 },
        ask:        { file:'ask',       durationScale:1.00 },
        skeptical:  { file:'skeptical', durationScale:1.00 },
        surprised:  { file:'surprised', durationScale:1.20 },
        smug:       { file:'smug',      durationScale:2.00 }
      }
    }
  };

  class CharacterAnimator {
    constructor(canvas, characterId) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', {alpha:true});
      this.characterId = characterId;
      this.config = CHARACTER_CONFIG[characterId];
      this.runToken = 0;
      this.decoder = null;
      this.currentMotion = null;
      this.animateMode = null;
      this.hasFrame = false;
    }

    async resolveMotion(fileBase) {
      const candidates = [
        {ext:'webp', type:'image/webp'},
        {ext:'gif',  type:'image/gif'}
      ];
      for (const candidate of candidates) {
        let supported = true;
        try { supported = await ImageDecoder.isTypeSupported(candidate.type); }
        catch (_) { supported = false; }
        if (!supported) continue;
        for (const folder of this.config.folders) {
          const url = `${folder}/${fileBase}.${candidate.ext}`;
          try {
            const response = await fetch(url, {cache:'force-cache'});
            if (response.ok) {
              return {url, type:candidate.type, buffer:await response.arrayBuffer()};
            }
          } catch (_) {}
        }
      }
      throw new Error(`Missing character asset: ${this.characterId}/${fileBase}.{webp,gif}`);
    }

    clear() {
      if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width || 1, this.canvas.height || 1);
    }

    stop() {
      this.runToken += 1;
      try { this.decoder?.close?.(); } catch (_) {}
      this.decoder = null;
      this.currentMotion = null;
      this.animateMode = null;
      this.hasFrame = false;
    }

    async show(motionName='normal', animate=true) {
      const motion = this.config.motions[motionName] || this.config.motions.normal;
      const resolvedName = this.config.motions[motionName] ? motionName : 'normal';
      if (this.currentMotion === resolvedName && this.animateMode === !!animate && (this.decoder || this.hasFrame)) return;

      this.stop();
      const token = this.runToken;
      this.currentMotion = resolvedName;
      this.animateMode = !!animate;
      this.canvas.dataset.missing = 'false';

      if (!('ImageDecoder' in window)) {
        this.canvas.dataset.missing = 'true';
        return;
      }

      try {
        const asset = await this.resolveMotion(motion.file);
        if (token !== this.runToken) return;
        const decoder = new ImageDecoder({data:asset.buffer, type:asset.type, preferAnimation:true});
        this.decoder = decoder;
        await decoder.tracks.ready;
        const track = decoder.tracks.selectedTrack;
        const frameCount = Math.max(1, track?.frameCount || 1);
        let index = 0;

        while (token === this.runToken) {
          const result = await decoder.decode({frameIndex:index});
          if (token !== this.runToken) {
            try { result.image.close(); } catch (_) {}
            return;
          }

          const frame = result.image;
          const w = frame.displayWidth || frame.codedWidth || 1;
          const h = frame.displayHeight || frame.codedHeight || 1;
          if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w;
            this.canvas.height = h;
          }
          this.ctx.clearRect(0, 0, w, h);
          this.ctx.drawImage(frame, 0, 0, w, h);
          this.hasFrame = true;

          const durationUs = Number(frame.duration) || 100000;
          try { frame.close(); } catch (_) {}

          if (!animate || frameCount <= 1) {
            try { decoder.close(); } catch (_) {}
            if (this.decoder === decoder) this.decoder = null;
            return;
          }

          const durationScale = Math.max(.25, Number(motion.durationScale) || 1);
          const wait = Math.max(24, Math.min(1800, (durationUs / 1000) * durationScale));
          await sleep(wait);
          if (token !== this.runToken) return;

          // Natural forward loop only. The asset itself owns the seam.
          index = (index + 1) % frameCount;
        }
      } catch (_) {
        if (token !== this.runToken) return;
        this.clear();
        this.canvas.dataset.missing = 'true';
      }
    }
  }

  ns.CHARACTER_CONFIG = CHARACTER_CONFIG;
  ns.CharacterAnimator = CharacterAnimator;
})();
