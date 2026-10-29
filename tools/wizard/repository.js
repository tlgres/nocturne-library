(() => {
  const DB_NAME = 'deconstructed-library-wizard';
  const STORE = 'handles';
  const HANDLE_KEY = 'repo-root';

  function parts(path) {
    return String(path || '').replace(/\\/g, '/').split('/').filter(Boolean);
  }

  async function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function rememberHandle(handle) {
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(handle, HANDLE_KEY);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (_) {}
  }

  async function loadRememberedHandle() {
    try {
      const db = await openDb();
      const value = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(HANDLE_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      db.close();
      return value;
    } catch (_) {
      return null;
    }
  }

  async function ensurePermission(handle, write = false) {
    if (!handle) return false;
    const opts = { mode: write ? 'readwrite' : 'read' };
    if ((await handle.queryPermission(opts)) === 'granted') return true;
    return (await handle.requestPermission(opts)) === 'granted';
  }

  class Repository {
    constructor() {
      this.root = null;
      this.categories = [];
      this.library = null;
      this.series = [];
    }

    async chooseRoot() {
      if (!window.showDirectoryPicker) throw new Error('이 브라우저는 File System Access API를 지원하지 않습니다. Chrome/Edge에서 localhost로 열어주세요.');
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      await this.attach(handle);
      await rememberHandle(handle);
      return handle;
    }

    async reconnect() {
      const handle = await loadRememberedHandle();
      if (!handle) return false;
      if (!(await ensurePermission(handle, true))) return false;
      await this.attach(handle);
      return true;
    }

    async attach(handle) {
      if (!(await ensurePermission(handle, true))) throw new Error('Repository 폴더 읽기/쓰기 권한이 필요합니다.');
      this.root = handle;
      await this.verify();
      await this.reload();
    }

    async getDirectory(path, create = false) {
      if (!this.root) throw new Error('Repository가 선택되지 않았습니다.');
      let dir = this.root;
      for (const segment of parts(path)) dir = await dir.getDirectoryHandle(segment, { create });
      return dir;
    }

    async getFileHandle(path, create = false) {
      const p = parts(path);
      const filename = p.pop();
      if (!filename) throw new Error(`잘못된 파일 경로: ${path}`);
      const dir = await this.getDirectory(p.join('/'), create);
      return dir.getFileHandle(filename, { create });
    }

    async exists(path) {
      try { await this.getFileHandle(path, false); return true; } catch (_) { return false; }
    }

    async readText(path) {
      const handle = await this.getFileHandle(path, false);
      const file = await handle.getFile();
      return file.text();
    }

    async readJson(path) {
      const text = await this.readText(path);
      try { return JSON.parse(text); } catch (err) { throw new Error(`${path} JSON 파싱 실패: ${err.message}`); }
    }

    async writeText(path, text) {
      const handle = await this.getFileHandle(path, true);
      const writable = await handle.createWritable();
      await writable.write(String(text));
      await writable.close();
    }

    async writeJson(path, value) {
      await this.writeText(path, JSON.stringify(value, null, 2) + '\n');
    }

    async writeFile(path, file) {
      const handle = await this.getFileHandle(path, true);
      const writable = await handle.createWritable();
      await writable.write(await file.arrayBuffer());
      await writable.close();
    }

    async verify() {
      const required = ['web/library.json', 'web/categories.json'];
      for (const path of required) {
        if (!(await this.exists(path))) throw new Error(`필수 파일 ${path}을 찾지 못했습니다. Repository 루트 폴더를 선택했는지 확인하세요.`);
      }
    }

    async reload() {
      this.categories = (await this.readJson('web/categories.json')).categories || [];
      this.library = await this.readJson('web/library.json');
      this.series = [];
      for (const entry of this.library.series || []) {
        try {
          const meta = await this.readJson(`web/${entry.meta}`);
          this.series.push({ entry, meta, base: `web/${entry.path}` });
        } catch (error) {
          this.series.push({ entry, meta: null, base: `web/${entry.path}`, error: error.message });
        }
      }
      return this.series;
    }

    getSeriesById(id) {
      return this.series.find(x => x.meta?.id === id) || null;
    }

    suggestNextLecture(series) {
      const lectures = series?.meta?.lectures || [];
      const numeric = lectures.map(x => Number.parseInt(x.id, 10)).filter(Number.isFinite);
      const next = numeric.length ? Math.max(...numeric) + 1 : lectures.length + 1;
      const width = Math.max(2, ...lectures.map(x => String(x.id || '').length));
      const id = String(next).padStart(width, '0');
      return { id, file: `${id}.md` };
    }

    async loadLecture(series, lecture) {
      return this.readText(`${series.base}/${lecture.file}`);
    }

    async createSeries(data) {
      const id = String(data.id || '').trim();
      const category = String(data.category || '').trim();
      if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error('Series ID는 영문 소문자/숫자/하이픈만 사용하는 것을 권장합니다.');
      if (!this.categories.some(x => x.slug === category)) throw new Error('알 수 없는 카테고리입니다.');
      if (this.series.some(x => x.meta?.id === id)) throw new Error('같은 Series ID가 이미 있습니다.');
      const baseRel = `content/${category}/${id}`;
      const base = `web/${baseRel}`;
      await this.getDirectory(base, true);
      const today = new Date().toISOString().slice(0, 10);
      const meta = {
        schemaVersion: 1,
        id,
        title: String(data.title || id).trim(),
        category,
        description: String(data.description || '').trim(),
        prologue: String(data.prologue || '').trim() || undefined,
        language: 'ko',
        status: 'ongoing',
        kind: data.kind && data.kind !== 'lecture' ? data.kind : undefined,
        createdAt: today,
        updatedAt: today,
        lectures: []
      };
      if (!meta.kind) delete meta.kind;
      if (!meta.prologue) delete meta.prologue;
      await this.writeJson(`${base}/meta.json`, meta);
      this.library.series = this.library.series || [];
      this.library.series.push({ path: baseRel, meta: `${baseRel}/meta.json` });
      await this.writeJson('web/library.json', this.library);
      await this.reload();
      return this.getSeriesById(id);
    }

    async saveLecture({ series, id, file, title, source, dialogueSpeakers, existingId = null }) {
      if (!series?.meta) throw new Error('시리즈가 선택되지 않았습니다.');
      const lectureId = String(id || '').trim();
      const filename = String(file || '').trim();
      if (!lectureId || !filename) throw new Error('Lecture ID와 파일명이 필요합니다.');
      if (!/^[^/\\]+\.md$/i.test(filename)) throw new Error('강의 파일명은 .md 파일이어야 하며 폴더 구분자를 포함할 수 없습니다.');
      const duplicate = series.meta.lectures.find(x => x.id === lectureId && x.id !== existingId);
      if (duplicate) throw new Error(`Lecture ID ${lectureId}가 이미 존재합니다.`);
      const fileDuplicate = series.meta.lectures.find(x => x.file === filename && x.id !== existingId);
      if (fileDuplicate) throw new Error(`파일 ${filename}이 이미 사용 중입니다.`);

      await this.writeText(`${series.base}/${filename}`, source.trimEnd() + '\n');
      const today = new Date().toISOString().slice(0, 10);
      let entry = existingId ? series.meta.lectures.find(x => x.id === existingId) : null;
      if (!entry) {
        entry = { id: lectureId, file: filename, title: String(title || lectureId).trim() };
        series.meta.lectures.push(entry);
      } else {
        entry.id = lectureId;
        entry.file = filename;
        entry.title = String(title || lectureId).trim();
      }
      series.meta.updatedAt = today;
      if (!series.meta.createdAt) series.meta.createdAt = today;
      if (dialogueSpeakers && Object.keys(dialogueSpeakers).length) series.meta.dialogueSpeakers = dialogueSpeakers;
      await this.writeJson(`${series.base}/meta.json`, series.meta);
      await this.reload();
      return this.getSeriesById(series.meta.id);
    }


    async updateSeriesMetadata(series, data) {
      if (!series?.meta) throw new Error('시리즈가 선택되지 않았습니다.');
      series.meta.title = String(data.title || series.meta.title || series.meta.id).trim();
      series.meta.description = String(data.description || '').trim();
      const prologue = String(data.prologue || '').trim();
      if (prologue.length > 500) throw new Error('프롤로그는 500자 이하로 작성하세요.');
      if (prologue) series.meta.prologue = prologue; else delete series.meta.prologue;
      if (data.cover === null) delete series.meta.cover;
      else if (typeof data.cover === 'string' && data.cover) series.meta.cover = data.cover;
      series.meta.updatedAt = new Date().toISOString().slice(0, 10);
      await this.writeJson(`${series.base}/meta.json`, series.meta);
      await this.reload();
      return this.getSeriesById(series.meta.id);
    }

    async saveCoverAsset(series, file) {
      if (!series?.meta) throw new Error('시리즈가 선택되지 않았습니다.');
      const extMatch = /\.(png|jpe?g|webp)$/i.exec(file.name || '');
      const ext = extMatch ? extMatch[1].toLowerCase().replace('jpeg', 'jpg') : 'webp';
      const filename = `cover.${ext}`;
      await this.getDirectory(`${series.base}/assets`, true);
      await this.writeFile(`${series.base}/assets/${filename}`, file);
      return `assets/${filename}`;
    }

    async saveSpeakerAsset(series, speakerId, file) {
      const extMatch = /\.(png|jpe?g|webp|gif)$/i.exec(file.name || '');
      const ext = extMatch ? extMatch[1].toLowerCase().replace('jpeg', 'jpg') : 'png';
      const rawSpeaker = String(speakerId || 'speaker').trim();

      // Prefer a readable ASCII id when possible. For Korean/Japanese/etc. speaker
      // ids, the old regexp collapsed every name to '-' and caused all thumbnails
      // to overwrite the same assets/-.webp file. Use a deterministic Unicode hash
      // fallback so every distinct speaker gets a stable, collision-resistant name.
      let safeSpeaker = rawSpeaker.toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');

      if (!safeSpeaker) {
        let hash = 2166136261;
        for (const ch of rawSpeaker) {
          hash ^= ch.codePointAt(0);
          hash = Math.imul(hash, 16777619) >>> 0;
        }
        safeSpeaker = `speaker-${hash.toString(16).padStart(8, '0')}`;
      }

      const filename = `${safeSpeaker}.${ext}`;
      await this.getDirectory(`${series.base}/assets`, true);
      await this.writeFile(`${series.base}/assets/${filename}`, file);
      return `assets/${filename}`;
    }
  }

  globalThis.WizardRepository = { Repository, ensurePermission };
})();
