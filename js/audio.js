/**
 * Master Preservation Dual Audio Engine with Channel & Audio Source Deletion/Reset
 * Allows complete deletion of custom channels and clean reset of custom audio overrides.
 */

class AudioStorage {
    constructor() {
        this.dbName = 'AmbientFocusAudioDB';
        this.storeName = 'audio_files';
        this.db = null;
    }

    async init() {
        if (this.db) return this.db;
        return new Promise((resolve) => {
            const req = indexedDB.open(this.dbName, 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
            };
            req.onsuccess = (e) => {
                this.db = e.target.result;
                resolve(this.db);
            };
            req.onerror = () => resolve(null);
        });
    }

    _blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    _base64ToBlob(base64Data) {
        try {
            const arr = base64Data.split(',');
            const mimeMatch = arr[0].match(/:(.*?);/);
            const mime = mimeMatch ? mimeMatch[1] : 'audio/mp3';
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            return new Blob([u8arr], { type: mime });
        } catch (e) {
            return null;
        }
    }

    async saveAudio(channelId, fileBlob) {
        try {
            await this.init();
            if (this.db) {
                await new Promise((resolve) => {
                    const tx = this.db.transaction(this.storeName, 'readwrite');
                    const store = tx.objectStore(this.storeName);
                    const req = store.put(fileBlob, channelId);
                    req.onsuccess = () => resolve(true);
                    req.onerror = () => resolve(false);
                });
            }
        } catch (e) {
            console.error('IndexedDB save error:', e);
        }

        try {
            if (fileBlob && fileBlob.size < 12 * 1024 * 1024) {
                const b64 = await this._blobToBase64(fileBlob);
                localStorage.setItem('ambient_audio_b64_' + channelId, b64);
            }
        } catch (e) {
            console.warn('LocalStorage Base64 backup warning:', e);
        }

        return true;
    }

    async getAudio(channelId) {
        try {
            await this.init();
            if (this.db) {
                const idbResult = await new Promise((resolve) => {
                    const tx = this.db.transaction(this.storeName, 'readonly');
                    const store = tx.objectStore(this.storeName);
                    const req = store.get(channelId);
                    req.onsuccess = () => resolve(req.result || null);
                    req.onerror = () => resolve(null);
                });
                if (idbResult) return idbResult;
            }
        } catch (e) {
            console.warn('IndexedDB read warning:', e);
        }

        try {
            const b64 = localStorage.getItem('ambient_audio_b64_' + channelId);
            if (b64) {
                const blob = this._base64ToBlob(b64);
                if (blob) {
                    this.saveAudio(channelId, blob).catch(() => {});
                    return blob;
                }
            }
        } catch (e) {
            console.warn('LocalStorage Base64 read error:', e);
        }

        return null;
    }

    async deleteAudio(channelId) {
        try {
            localStorage.removeItem('ambient_audio_b64_' + channelId);
        } catch (e) {}

        try {
            await this.init();
            if (this.db) {
                return new Promise((resolve) => {
                    const tx = this.db.transaction(this.storeName, 'readwrite');
                    const store = tx.objectStore(this.storeName);
                    const req = store.delete(channelId);
                    req.onsuccess = () => resolve(true);
                    req.onerror = () => resolve(false);
                });
            }
        } catch (e) {
            return false;
        }
    }
}

const audioStorage = new AudioStorage();


class MasterStore {
    constructor() {
        this.STORAGE_KEY = 'ambient_studio_master_store_v1';
        this.BACKUP_KEY = 'ambient_studio_master_backup_v1';
    }

    load() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (raw) return JSON.parse(raw);
            const backup = localStorage.getItem(this.BACKUP_KEY);
            if (backup) return JSON.parse(backup);
        } catch (e) {
            console.warn('MasterStore load warning:', e);
        }
        return {
            metas: {},
            userChannels: [],
            customPresets: [],
            volumes: {}
        };
    }

    save(storeObj) {
        try {
            const dataStr = JSON.stringify(storeObj);
            const current = localStorage.getItem(this.STORAGE_KEY);
            if (current) {
                localStorage.setItem(this.BACKUP_KEY, current);
            }
            localStorage.setItem(this.STORAGE_KEY, dataStr);
        } catch (e) {
            console.error('MasterStore save error:', e);
        }
    }
}

const masterStore = new MasterStore();


class GaplessLoopPlayer {
    constructor(src, crossfadeSec = 1.5) {
        this.src = src;
        this.crossfadeSec = crossfadeSec;
        this.audioA = new Audio();
        this.audioB = new Audio();
        
        if (src) {
            this.audioA.src = src;
            this.audioB.src = src;
        }
        
        this.audioA.preload = 'auto';
        this.audioB.preload = 'auto';
        
        this.active = 'A';
        this.targetVol = 0.0;
        this.isCrossfading = false;
        this.timer = null;
        this.fadeInterval = null;
        this.isPlaying = false;
    }

    setSrc(src) {
        this.stop();
        this.src = src;
        this.audioA.src = src;
        this.audioB.src = src;
        this.audioA.load();
        this.audioB.load();
        this.active = 'A';
    }

    setCrossfadeTime(sec) {
        this.crossfadeSec = Math.max(0.2, Math.min(5, sec));
    }

    setVolume(vol) {
        this.targetVol = Math.max(0, Math.min(1, vol));
        if (!this.isCrossfading) {
            const currentAudio = this.active === 'A' ? this.audioA : this.audioB;
            currentAudio.volume = this.targetVol;
            const otherAudio = this.active === 'A' ? this.audioB : this.audioA;
            otherAudio.volume = 0;
        }
    }

    play() {
        if (!this.src || this.targetVol === 0) return;
        this.isPlaying = true;

        const currentAudio = this.active === 'A' ? this.audioA : this.audioB;
        currentAudio.volume = this.targetVol;
        
        if (currentAudio.paused && this.targetVol > 0) {
            currentAudio.play().catch(() => {});
        }

        this._startMonitor();
    }

    stop() {
        this.isPlaying = false;
        if (this.timer) clearInterval(this.timer);
        if (this.fadeInterval) clearInterval(this.fadeInterval);
        this.timer = null;
        this.fadeInterval = null;

        if (this.audioA) {
            this.audioA.pause();
            this.audioA.currentTime = 0;
            this.audioA.volume = 0;
        }
        if (this.audioB) {
            this.audioB.pause();
            this.audioB.currentTime = 0;
            this.audioB.volume = 0;
        }
        this.isCrossfading = false;
    }

    _startMonitor() {
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => {
            if (!this.isPlaying || this.targetVol === 0) return;

            const current = this.active === 'A' ? this.audioA : this.audioB;
            const next = this.active === 'A' ? this.audioB : this.audioA;

            if (!current.duration || isNaN(current.duration)) return;

            const remaining = current.duration - current.currentTime;
            const effectiveFadeSec = Math.min(this.crossfadeSec, current.duration * 0.15);

            if (remaining <= effectiveFadeSec && !this.isCrossfading && remaining > 0.05) {
                this.isCrossfading = true;
                next.currentTime = 0;
                next.volume = 0;
                next.play().catch(() => {});

                const steps = 30;
                const intervalTime = (effectiveFadeSec * 1000) / steps;
                let stepCount = 0;

                if (this.fadeInterval) clearInterval(this.fadeInterval);
                this.fadeInterval = setInterval(() => {
                    stepCount++;
                    const progress = stepCount / steps;

                    current.volume = Math.max(0, this.targetVol * (1 - progress));
                    next.volume = Math.min(this.targetVol, this.targetVol * progress);

                    if (stepCount >= steps) {
                        clearInterval(this.fadeInterval);
                        this.fadeInterval = null;
                        current.pause();
                        current.currentTime = 0;
                        this.active = this.active === 'A' ? 'B' : 'A';
                        this.isCrossfading = false;
                    }
                }, intervalTime);
            }
        }, 120);
    }
}


class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.isInitialized = false;
        this.masterVolume = 0.8;
        this.isMasterMuted = false;
        this.soloChannelId = null;
        this.crossfadeSec = 1.5;

        // Default Sound Channels definition
        this.defaultChannels = [
            { id: 'rain', name: '雨の音 (Rain)', category: 'nature', icon: '', defaultVol: 0.6, file: 'assets/audio/heavy_rain.mp3' },
            { id: 'window_rain', name: '窓に打つ雨 (Window Rain)', category: 'nature', icon: '', defaultVol: 0.4, file: 'assets/audio/steady_rain.mp3' },
            { id: 'thunder', name: '遠雷 (Thunder)', category: 'nature', icon: '', defaultVol: 0.25, file: null },
            { id: 'wind', name: '風とフクロウ (Wind & Owl)', category: 'nature', icon: '', defaultVol: 0.4, file: 'assets/audio/wind_owl.mp3' },
            { id: 'ocean', name: '渓流と葉の雨 (Stream & Leaves)', category: 'nature', icon: '', defaultVol: 0.35, file: 'assets/audio/stream_leaf.mp3' },
            { id: 'fireplace', name: '暖炉の薪 (Fireplace)', category: 'cozy', icon: '', defaultVol: 0.45, file: null },
            { id: 'birds', name: '夜の風気配 (Night Insects)', category: 'nature', icon: '', defaultVol: 0.3, file: 'assets/audio/insect_shaker.mp3' },
            { id: 'cafe', name: 'カフェの気配 (Cafe)', category: 'urban', icon: '', defaultVol: 0.3, file: null },
            { id: 'keyboard', name: 'キーボード打鍵音 (Keyboard)', category: 'urban', icon: '', defaultVol: 0.2, file: null },
            { id: 'brown_noise', name: 'ブラウンノイズ (Brown Noise)', category: 'noise', icon: '', defaultVol: 0.3, file: null },
            { id: 'pink_noise', name: 'ピンクノイズ (Pink Noise)', category: 'noise', icon: '', defaultVol: 0.0, file: null },
            { id: 'white_noise', name: 'ホワイトノイズ (White Noise)', category: 'noise', icon: '', defaultVol: 0.0, file: null }
        ];

        this.channels = [];
        this.nodes = {};
        this.states = {};
        this.gaplessPlayers = {};

        this._loadChannelsFromStorage();
    }

    _loadChannelsFromStorage() {
        const store = masterStore.load();
        const deletedIds = Array.isArray(store.deletedChannelIds) ? store.deletedChannelIds : [];

        this.channels = this.defaultChannels
            .filter(ch => !deletedIds.includes(ch.id))
            .map(ch => {
                const meta = store.metas[ch.id] || {};
                return {
                    ...ch,
                    name: meta.name || ch.name,
                    icon: meta.icon || ch.icon
                };
            });

        if (Array.isArray(store.userChannels)) {
            store.userChannels.forEach(userCh => {
                if (!deletedIds.includes(userCh.id) && !this.channels.some(c => c.id === userCh.id)) {
                    this.channels.push(userCh);
                }
            });
        }

        this.channels.forEach(ch => {
            const savedVol = (store.volumes && store.volumes[ch.id] !== undefined) ? store.volumes[ch.id] : ch.defaultVol;
            const savedFileName = (store.metas && store.metas[ch.id] && store.metas[ch.id].fileName) || null;

            this.states[ch.id] = {
                volume: savedVol !== undefined ? savedVol : 0.4,
                muted: false,
                customAudioUrl: null,
                customFileName: savedFileName
            };
        });
    }

    async init() {
        if (this.isInitialized) return;
        
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
            this.ctx = new AudioCtx();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime); // Silent on startup
            this.masterGain.connect(this.ctx.destination);
        }

        for (const ch of this.channels) {
            const savedBlob = await audioStorage.getAudio(ch.id);
            if (savedBlob) {
                const url = URL.createObjectURL(savedBlob);
                this.states[ch.id].customAudioUrl = url;
            }
        }

        this.channels.forEach(ch => {
            this._setupChannel(ch);
        });

        this.isInitialized = true;
    }

    resumeCtx() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    startAll() {
        this.init();
        this.resumeCtx();

        if (this.masterGain && this.ctx) {
            const effectiveMaster = this.isMasterMuted ? 0 : this.masterVolume;
            this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
            this.masterGain.gain.linearRampToValueAtTime(effectiveMaster, this.ctx.currentTime + 0.05);
        }

        this.channels.forEach(ch => {
            if (this.gaplessPlayers[ch.id]) {
                this.gaplessPlayers[ch.id].play();
            }
            this._updateGain(ch.id);
        });
    }

    stopAll() {
        this.channels.forEach(ch => {
            if (this.gaplessPlayers[ch.id]) {
                this.gaplessPlayers[ch.id].stop();
            }
        });
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
        }
    }

    setGlobalCrossfadeSec(sec) {
        this.crossfadeSec = Math.max(0.2, Math.min(5, sec));
        Object.keys(this.gaplessPlayers).forEach(id => {
            this.gaplessPlayers[id].setCrossfadeTime(this.crossfadeSec);
        });
    }

    async addCustomChannel(name, icon, audioFile) {
        const id = 'user_ch_' + Date.now();
        let url = null;
        let fileName = null;

        if (audioFile) {
            url = URL.createObjectURL(audioFile);
            fileName = audioFile.name;
            await audioStorage.saveAudio(id, audioFile);
        }

        const newCh = {
            id: id,
            name: name || 'マイ音源',
            icon: icon || '🎵',
            category: 'custom',
            defaultVol: 0.5,
            file: url,
            isUserCreated: true
        };

        this.channels.push(newCh);
        this.states[id] = {
            volume: 0.5,
            muted: false,
            customAudioUrl: url,
            customFileName: fileName
        };

        const store = masterStore.load();
        if (!store.userChannels) store.userChannels = [];
        store.userChannels.push({
            id: id,
            name: newCh.name,
            icon: newCh.icon,
            category: 'custom',
            defaultVol: 0.5,
            isUserCreated: true
        });
        if (!store.metas) store.metas = {};
        store.metas[id] = { name: newCh.name, icon: newCh.icon, fileName: fileName };
        if (!store.volumes) store.volumes = {};
        store.volumes[id] = 0.5;
        masterStore.save(store);

        if (this.isInitialized) {
            this._setupChannel(newCh);
        }

        return id;
    }

    updateChannelMeta(id, newName, newIcon) {
        const ch = this.channels.find(c => c.id === id);
        if (!ch) return;

        ch.name = newName || ch.name;
        ch.icon = newIcon || ch.icon;

        const store = masterStore.load();
        if (!store.metas) store.metas = {};
        store.metas[id] = {
            ...store.metas[id],
            name: ch.name,
            icon: ch.icon
        };

        if (ch.isUserCreated && Array.isArray(store.userChannels)) {
            const uCh = store.userChannels.find(c => c.id === id);
            if (uCh) {
                uCh.name = ch.name;
                uCh.icon = ch.icon;
            }
        }

        masterStore.save(store);
    }

    deleteChannel(id) {
        const idx = this.channels.findIndex(c => c.id === id);
        if (idx === -1) return;

        if (this.gaplessPlayers[id]) {
            this.gaplessPlayers[id].stop();
            delete this.gaplessPlayers[id];
        }

        if (this.nodes[id]) {
            if (typeof this.nodes[id].destroySynth === 'function') {
                try { this.nodes[id].destroySynth(); } catch(e) {}
            }
            if (this.nodes[id].gainNode && this.ctx) {
                try {
                    this.nodes[id].gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
                    this.nodes[id].gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
                    this.nodes[id].gainNode.disconnect();
                } catch(e) {}
            }
            delete this.nodes[id];
        }

        audioStorage.deleteAudio(id);

        if (this.soloChannelId === id) {
            this.soloChannelId = null;
        }

        delete this.states[id];
        this.channels.splice(idx, 1);

        const store = masterStore.load();
        if (!Array.isArray(store.deletedChannelIds)) {
            store.deletedChannelIds = [];
        }
        if (!store.deletedChannelIds.includes(id)) {
            store.deletedChannelIds.push(id);
        }
        if (Array.isArray(store.userChannels)) {
            store.userChannels = store.userChannels.filter(c => c.id !== id);
        }
        if (store.metas && store.metas[id]) {
            delete store.metas[id];
        }
        if (store.volumes && store.volumes[id] !== undefined) {
            delete store.volumes[id];
        }
        masterStore.save(store);
    }

    deleteCustomChannel(id) {
        this.deleteChannel(id);
    }

    hasDeletedDefaultChannels() {
        const store = masterStore.load();
        const deletedIds = Array.isArray(store.deletedChannelIds) ? store.deletedChannelIds : [];
        return this.defaultChannels.some(ch => deletedIds.includes(ch.id));
    }

    restoreAllDefaultChannels() {
        const store = masterStore.load();
        store.deletedChannelIds = [];
        masterStore.save(store);

        this._loadChannelsFromStorage();

        if (this.isInitialized) {
            this.channels.forEach(ch => {
                if (!this.gaplessPlayers[ch.id] && !this.nodes[ch.id]) {
                    this._setupChannel(ch);
                }
            });
        }
    }

    resetChannelAudio(id) {
        const st = this.states[id];
        if (!st) return;

        if (this.gaplessPlayers[id]) {
            this.gaplessPlayers[id].stop();
            delete this.gaplessPlayers[id];
        }

        if (this.nodes[id]) {
            if (typeof this.nodes[id].destroySynth === 'function') {
                try { this.nodes[id].destroySynth(); } catch(e) {}
            }
            if (this.nodes[id].gainNode && this.ctx) {
                try {
                    this.nodes[id].gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
                    this.nodes[id].gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
                    this.nodes[id].gainNode.disconnect();
                } catch(e) {}
            }
            delete this.nodes[id];
        }

        audioStorage.deleteAudio(id);
        st.customAudioUrl = null;
        st.customFileName = null;

        const ch = this.channels.find(c => c.id === id);
        if (ch && ch.isUserCreated) {
            ch.file = null;
        }

        const store = masterStore.load();
        if (store.metas && store.metas[id]) {
            delete store.metas[id].fileName;
            masterStore.save(store);
        }

        if (ch) {
            this._setupChannel(ch);
        }
    }

    async loadCustomFile(id, file) {
        if (!this.states[id]) return;

        const url = URL.createObjectURL(file);
        const fileName = file.name;
        const st = this.states[id];

        st.customAudioUrl = url;
        st.customFileName = fileName;

        await audioStorage.saveAudio(id, file);

        const store = masterStore.load();
        if (!store.metas) store.metas = {};
        store.metas[id] = {
            ...store.metas[id],
            fileName: fileName
        };
        masterStore.save(store);

        if (this.nodes[id]) {
            if (typeof this.nodes[id].destroySynth === 'function') {
                try { this.nodes[id].destroySynth(); } catch(e) {}
            }
            if (this.nodes[id].gainNode && this.ctx) {
                try {
                    this.nodes[id].gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
                    this.nodes[id].gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
                    this.nodes[id].gainNode.disconnect();
                } catch(e) {}
            }
            delete this.nodes[id];
        }

        if (this.gaplessPlayers[id]) {
            this.gaplessPlayers[id].stop();
            this.gaplessPlayers[id].setSrc(url);
        } else {
            this.gaplessPlayers[id] = new GaplessLoopPlayer(url, this.crossfadeSec);
        }

        this._updateGain(id);
    }

    _setupChannel(ch) {
        const id = ch.id;
        const st = this.states[id];

        if (st && st.customAudioUrl) {
            const player = new GaplessLoopPlayer(st.customAudioUrl, this.crossfadeSec);
            this.gaplessPlayers[id] = player;
        } else if (ch.file) {
            const player = new GaplessLoopPlayer(ch.file, this.crossfadeSec);
            this.gaplessPlayers[id] = player;
        }

        if (this.ctx && !ch.file && (!st || !st.customAudioUrl)) {
            const gainNode = this.ctx.createGain();
            gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
            gainNode.connect(this.masterGain);

            let synthDestroyer = null;
            switch (id) {
                case 'brown_noise':
                    synthDestroyer = this._createBrownNoise(gainNode);
                    break;
                case 'pink_noise':
                    synthDestroyer = this._createPinkNoise(gainNode);
                    break;
                case 'white_noise':
                    synthDestroyer = this._createWhiteNoise(gainNode);
                    break;
                case 'thunder':
                    synthDestroyer = this._createThunderSound(gainNode);
                    break;
                case 'fireplace':
                    synthDestroyer = this._createFireplaceSound(gainNode);
                    break;
                case 'cafe':
                    synthDestroyer = this._createCafeSound(gainNode);
                    break;
                case 'keyboard':
                    synthDestroyer = this._createKeyboardSound(gainNode);
                    break;
                default:
                    break;
            }

            this.nodes[id] = {
                gainNode: gainNode,
                destroySynth: synthDestroyer
            };
        }
    }

    _updateGain(id) {
        const st = this.states[id];
        if (!st) return;

        let effectiveVol = st.volume;

        if (st.muted || this.isMasterMuted) {
            effectiveVol = 0;
        } else if (this.soloChannelId !== null && this.soloChannelId !== id) {
            effectiveVol = 0;
        }

        const masterVolFactor = this.isMasterMuted ? 0 : this.masterVolume;
        const finalVol = Math.max(0, Math.min(1, effectiveVol * masterVolFactor));

        if (this.gaplessPlayers[id]) {
            this.gaplessPlayers[id].setVolume(finalVol);
            if (finalVol > 0 && !this.gaplessPlayers[id].isPlaying && this.isInitialized) {
                this.gaplessPlayers[id].play();
            }

            if (this.ctx && this.nodes[id] && this.nodes[id].gainNode) {
                const gain = this.nodes[id].gainNode.gain;
                gain.cancelScheduledValues(this.ctx.currentTime);
                gain.setValueAtTime(0, this.ctx.currentTime);
            }
        } else if (this.ctx && this.nodes[id] && this.nodes[id].gainNode) {
            const gain = this.nodes[id].gainNode.gain;
            gain.cancelScheduledValues(this.ctx.currentTime);
            gain.linearRampToValueAtTime(effectiveVol, this.ctx.currentTime + 0.05);
        }

        const store = masterStore.load();
        if (!store.volumes) store.volumes = {};
        store.volumes[id] = st.volume;
        masterStore.save(store);
    }

    setMasterVolume(vol) {
        this.masterVolume = Math.max(0, Math.min(1, vol));
        if (this.masterGain && this.ctx) {
            const effectiveMaster = this.isMasterMuted ? 0 : this.masterVolume;
            this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
            this.masterGain.gain.linearRampToValueAtTime(effectiveMaster, this.ctx.currentTime + 0.05);
        }
        this.channels.forEach(ch => this._updateGain(ch.id));
    }

    toggleMasterMute() {
        this.isMasterMuted = !this.isMasterMuted;
        this.setMasterVolume(this.masterVolume);
        return this.isMasterMuted;
    }

    setChannelVolume(id, vol) {
        if (!this.states[id]) return;
        this.states[id].volume = Math.max(0, Math.min(1, Math.round(vol * 1000) / 1000));
        this._updateGain(id);
    }

    nudgeChannelVolume(id, delta) {
        if (!this.states[id]) return;
        const current = this.states[id].volume;
        this.setChannelVolume(id, current + delta);
        return this.states[id].volume;
    }

    toggleChannelMute(id) {
        if (!this.states[id]) return;
        this.states[id].muted = !this.states[id].muted;
        this._updateGain(id);
        return this.states[id].muted;
    }

    toggleChannelSolo(id) {
        if (this.soloChannelId === id) {
            this.soloChannelId = null;
        } else {
            this.soloChannelId = id;
        }
        this.channels.forEach(ch => this._updateGain(ch.id));
        return this.soloChannelId === id;
    }

    // --- PROCEDURAL SYNTHESIZERS ---

    _createNoiseBuffer(type = 'white') {
        const bufferSize = 5 * this.ctx.sampleRate;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = buffer.getChannelData(0);

        if (type === 'white') {
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }
        } else if (type === 'pink') {
            let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                b3 = 0.86650 * b3 + white * 0.3104856;
                b4 = 0.55000 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.0168980;
                output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
                output[i] *= 0.11;
                b6 = white * 0.115926;
            }
        } else if (type === 'brown') {
            let lastOut = 0.0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                output[i] = (lastOut + (0.02 * white)) / 1.02;
                lastOut = output[i];
                output[i] *= 3.5;
            }
        }
        return buffer;
    }

    _createLoopingNoiseSource(buffer) {
        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = buffer;
        whiteNoise.loop = true;
        whiteNoise.start(0);
        return whiteNoise;
    }

    _createWhiteNoise(outGain) {
        const src = this._createLoopingNoiseSource(this._createNoiseBuffer('white'));
        src.connect(outGain);
        return () => src.stop();
    }

    _createPinkNoise(outGain) {
        const src = this._createLoopingNoiseSource(this._createNoiseBuffer('pink'));
        src.connect(outGain);
        return () => src.stop();
    }

    _createBrownNoise(outGain) {
        const src = this._createLoopingNoiseSource(this._createNoiseBuffer('brown'));
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;
        src.connect(filter);
        filter.connect(outGain);
        return () => src.stop();
    }

    _createThunderSound(outGain) {
        const src = this._createLoopingNoiseSource(this._createNoiseBuffer('brown'));
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 120;

        const thunderGain = this.ctx.createGain();
        thunderGain.gain.value = 0.1;

        const triggerThunder = () => {
            if (!this.isInitialized) return;
            const now = this.ctx.currentTime;
            thunderGain.gain.cancelScheduledValues(now);
            thunderGain.gain.setValueAtTime(0.05, now);
            thunderGain.gain.exponentialRampToValueAtTime(0.8, now + 1.2);
            thunderGain.gain.exponentialRampToValueAtTime(0.02, now + 5.5);

            const nextTime = Math.random() * 25000 + 15000;
            this._thunderTimer = setTimeout(triggerThunder, nextTime);
        };

        src.connect(filter);
        filter.connect(thunderGain);
        thunderGain.connect(outGain);

        this._thunderTimer = setTimeout(triggerThunder, 3000);

        return () => {
            src.stop();
            clearTimeout(this._thunderTimer);
        };
    }

    _createFireplaceSound(outGain) {
        const baseSrc = this._createLoopingNoiseSource(this._createNoiseBuffer('brown'));
        const baseFilter = this.ctx.createBiquadFilter();
        baseFilter.type = 'lowpass';
        baseFilter.frequency.value = 250;
        baseSrc.connect(baseFilter);
        baseFilter.connect(outGain);

        let isPopping = true;
        const popCrackle = () => {
            if (!isPopping || !this.isInitialized) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const now = this.ctx.currentTime;

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(100 + Math.random() * 800, now);
            
            gain.gain.setValueAtTime(Math.random() * 0.15 + 0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

            osc.connect(gain);
            gain.connect(outGain);

            osc.start(now);
            osc.stop(now + 0.04);

            const nextPop = Math.random() * 150 + 20;
            this._fireTimer = setTimeout(popCrackle, nextPop);
        };

        this._fireTimer = setTimeout(popCrackle, 100);

        return () => {
            isPopping = false;
            baseSrc.stop();
            clearTimeout(this._fireTimer);
        };
    }

    _createCafeSound(outGain) {
        const src = this._createLoopingNoiseSource(this._createNoiseBuffer('pink'));
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 650;
        filter.Q.value = 1.2;

        src.connect(filter);
        filter.connect(outGain);
        return () => src.stop();
    }

    _createKeyboardSound(outGain) {
        let isActive = true;

        const typeClick = () => {
            if (!isActive || !this.isInitialized) return;
            const now = this.ctx.currentTime;
            
            const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.02, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noiseSrc = this.ctx.createBufferSource();
            noiseSrc.buffer = buffer;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 1800 + Math.random() * 600;
            filter.Q.value = 4.0;

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(Math.random() * 0.12 + 0.04, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);

            noiseSrc.connect(filter);
            filter.connect(gain);
            gain.connect(outGain);

            noiseSrc.start(now);

            const nextKey = Math.random() > 0.3 ? (Math.random() * 120 + 80) : (Math.random() * 800 + 400);
            this._keyTimer = setTimeout(typeClick, nextKey);
        };

        this._keyTimer = setTimeout(typeClick, 800);

        return () => {
            isActive = false;
            clearTimeout(this._keyTimer);
        };
    }

    playNotificationSound() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.15);
        osc.frequency.setValueAtTime(783.99, now + 0.3);
        osc.frequency.setValueAtTime(1046.50, now + 0.45);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 1.25);
    }
}

// Global instance
window.soundEngine = new SoundEngine();
