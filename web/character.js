(() => {
  'use strict';
  const ns = globalThis.NocturneWeb = globalThis.NocturneWeb || {};
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  const CHARACTER_CONFIG = {
    MUTE: {
      displayName: '뮤트',
      folders: ['characters/Mute'],
      motions: {
        normal:    { file:'normal.gif',   mode:'pingpong', speed:.75, holdStart:180, holdEnd:220 },
        thinking:  { file:'thinking.gif', mode:'pingpong', speed:.75, holdStart:180, holdEnd:260 },
        explain:   { file:'explain.gif',  mode:'pingpong', speed:.75, holdStart:120, holdEnd:210 },
        serious:   { file:'serious.gif',  mode:'pingpong', speed:.75, holdStart:210, holdEnd:280 },
        realize:   { file:'realize.gif',  mode:'once',     speed:.75, holdEnd:900 },
        confused:  { file:'confused.gif', mode:'pingpong', speed:.75, holdStart:160, holdEnd:240 }
      }
    },
    ED: {
      displayName: '이드',
      folders: ['characters/Ed'],
      motions: {
        normal:     { file:'normal.gif',    mode:'pingpong', speed:1, holdStart:180, holdEnd:220 },
        curious:    { file:'curious.gif',   mode:'pingpong', speed:1, holdStart:150, holdEnd:240 },
        ask:        { file:'ask.gif',       mode:'pingpong', speed:1, holdStart:180, holdEnd:260 },
        skeptical:  { file:'skeptical.gif', mode:'pingpong', speed:1, holdStart:160, holdEnd:240 },
        surprised:  { file:'surprised.gif', mode:'once',     speed:.8, holdEnd:900 },
        smug:       { file:'smug.gif',      mode:'pingpong', speed:.5, holdStart:150, holdEnd:240 }
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

    async resolveMotion(file) {
      for (const folder of this.config.folders) {
        const url = `${folder}/${file}`;
        try {
          const response = await fetch(url, {cache:'force-cache'});
          if (response.ok) return {url, buffer:await response.arrayBuffer()};
        } catch (_) {}
      }
      throw new Error(`Missing character asset: ${this.characterId}/${file}`);
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
        const supported = await ImageDecoder.isTypeSupported('image/gif');
        if (!supported) throw new Error('GIF ImageDecoder unsupported');
        const asset = await this.resolveMotion(motion.file);
        if (token !== this.runToken) return;
        const decoder = new ImageDecoder({data:asset.buffer, type:'image/gif', preferAnimation:true});
        this.decoder = decoder;
        await decoder.tracks.ready;
        const track = decoder.tracks.selectedTrack;
        const frameCount = Math.max(1, track?.frameCount || 1);
        let index = 0;
        let direction = 1;

        while (token === this.runToken) {
          const result = await decoder.decode({frameIndex:index});
          if (token !== this.runToken) { try { result.image.close(); } catch (_) {} return; }
          const frame = result.image;
          const w = frame.displayWidth || frame.codedWidth || 1;
          const h = frame.displayHeight || frame.codedHeight || 1;
          if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w;
            this.canvas.height = h;
          }
          this.ctx.clearRect(0,0,w,h);
          this.ctx.drawImage(frame,0,0,w,h);
          this.hasFrame = true;
          const durationUs = Number(frame.duration) || 100000;
          try { frame.close(); } catch (_) {}

          if (!animate || frameCount <= 1) {
            try { decoder.close(); } catch (_) {}
            if (this.decoder === decoder) this.decoder = null;
            return;
          }

          let wait = Math.max(45, Math.min(700, (durationUs / 1000) / Math.max(.2, motion.speed || 1)));
          const atStart = index === 0;
          const atEnd = index === frameCount - 1;
          if (atStart) wait += motion.holdStart || 0;
          if (atEnd) wait += motion.holdEnd || 0;
          await sleep(wait);
          if (token !== this.runToken) return;

          if (motion.mode === 'once') {
            if (atEnd) {
              try { decoder.close(); } catch (_) {}
              if (this.decoder === decoder) this.decoder = null;
              return;
            }
            index += 1;
            continue;
          }
          if (atEnd) direction = -1;
          else if (atStart) direction = 1;
          index = Math.max(0, Math.min(frameCount - 1, index + direction));
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
