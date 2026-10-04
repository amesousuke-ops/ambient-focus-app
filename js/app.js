/**
 * Ambient Focus App Main UI Logic & State Controller
 * Master Data Preservation Architecture: Guarantees zero data loss across updates.
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize Visualizer & Sound Engine
    const visualizer = new Visualizer('bgCanvas');
    visualizer.start();

    // Default Presets definition
    const defaultPresets = [
        {
            id: 'preset_rainy_study',
            name: '言の葉の雨・東屋 (Garden Rain Study)',
            bg: 'custom_rain',
            volumes: {
                rain: 0.65,
                window_rain: 0.40,
                thunder: 0.20,
                brown_noise: 0.30,
                fireplace: 0.15,
                wind: 0.0, ocean: 0.0, birds: 0.0, cafe: 0.0, keyboard: 0.0, pink_noise: 0.0, white_noise: 0.0
            }
        },
        {
            id: 'preset_midnight_cafe',
            name: '深夜の静寂カフェ (Midnight Cafe)',
            bg: 'minimal',
            volumes: {
                cafe: 0.50,
                keyboard: 0.25,
                pink_noise: 0.35,
                rain: 0.20,
                window_rain: 0.0, thunder: 0.0, wind: 0.0, ocean: 0.0, fireplace: 0.0, birds: 0.0, brown_noise: 0.0, white_noise: 0.0
            }
        },
        {
            id: 'preset_ocean_calm',
            name: '深海と波の瞑想 (Ocean Calm)',
            bg: 'stars',
            volumes: {
                ocean: 0.70,
                wind: 0.45,
                brown_noise: 0.50,
                rain: 0.0, window_rain: 0.0, thunder: 0.0, fireplace: 0.0, birds: 0.0, cafe: 0.0, keyboard: 0.0, pink_noise: 0.0, white_noise: 0.0
            }
        },
        {
            id: 'preset_forest_cabin',
            name: '森と暖炉のログハウス (Forest Cabin)',
            bg: 'fire',
            volumes: {
                fireplace: 0.60,
                birds: 0.35,
                wind: 0.30,
                white_noise: 0.15,
                rain: 0.0, window_rain: 0.0, thunder: 0.0, ocean: 0.0, cafe: 0.0, keyboard: 0.0, pink_noise: 0.0, brown_noise: 0.0
            }
        }
    ];

    // State Variables from MasterStore
    const masterData = masterStore.load();
    let customPresets = masterData.customPresets || [];
    let currentPresetId = 'preset_rainy_study';
    let isGlobalPlaying = false;

    // Pomodoro Timer State
    let timerDuration = 25 * 60;
    let timerRemaining = timerDuration;
    let timerInterval = null;
    let timerIsRunning = false;
    let timerMode = 'work';
    let totalFocusSeconds = parseInt(localStorage.getItem('ambient_total_focus_sec') || '0', 10);

    // Task Manager State
    let tasks = JSON.parse(localStorage.getItem('ambient_tasks') || '[]');

    // UI Elements References
    const soundGrid = document.getElementById('soundGrid');
    const restoreDefaultChannelsBtn = document.getElementById('restoreDefaultChannelsBtn');
    const masterVolumeRange = document.getElementById('masterVolumeRange');
    const masterVolumeVal = document.getElementById('masterVolumeVal');
    const masterMuteBtn = document.getElementById('masterMuteBtn');
    const masterPlayBtn = document.getElementById('masterPlayBtn');
    const crossfadeSelect = document.getElementById('crossfadeSelect');
    const presetSelect = document.getElementById('presetSelect');
    const savePresetBtn = document.getElementById('savePresetBtn');
    const deleteCurrentPresetBtn = document.getElementById('deleteCurrentPresetBtn');
    const bgSelect = document.getElementById('bgSelect');
    const focusModeBtn = document.getElementById('focusModeBtn');
    const uiOverlay = document.getElementById('uiOverlay');
    const focusExitHint = document.getElementById('focusExitHint');

    // Add Channel Modal Elements
    const openAddChannelBtn = document.getElementById('openAddChannelBtn');
    const addChannelModal = document.getElementById('addChannelModal');
    const closeAddChannelModal = document.getElementById('closeAddChannelModal');
    const cancelAddChBtn = document.getElementById('cancelAddChBtn');
    const submitAddChBtn = document.getElementById('submitAddChBtn');
    const newChIcon = document.getElementById('newChIcon');
    const newChName = document.getElementById('newChName');
    const newChFile = document.getElementById('newChFile');

    // Edit Channel Modal Elements
    const editChannelModal = document.getElementById('editChannelModal');
    const closeEditChannelModal = document.getElementById('closeEditChannelModal');
    const cancelEditChBtn = document.getElementById('cancelEditChBtn');
    const submitEditChBtn = document.getElementById('submitEditChBtn');
    const resetAudioChBtn = document.getElementById('resetAudioChBtn');
    const deleteChBtn = document.getElementById('deleteChBtn');
    const editChId = document.getElementById('editChId');
    const editChIcon = document.getElementById('editChIcon');
    const editChName = document.getElementById('editChName');

    // Preset Modal Elements
    const openPresetModalBtn = document.getElementById('openPresetModalBtn');
    const presetModal = document.getElementById('presetModal');
    const closePresetModal = document.getElementById('closePresetModal');
    const dismissPresetModalBtn = document.getElementById('dismissPresetModalBtn');
    const newPresetName = document.getElementById('newPresetName');
    const submitSavePresetBtn = document.getElementById('submitSavePresetBtn');
    const activeSoundsPreview = document.getElementById('activeSoundsPreview');
    const presetCardsList = document.getElementById('presetCardsList');

    // Pomodoro UI
    const timerDisplay = document.getElementById('timerDisplay');
    const timerStartBtn = document.getElementById('timerStartBtn');
    const timerResetBtn = document.getElementById('timerResetBtn');
    const workModeBtn = document.getElementById('workModeBtn');
    const shortBreakModeBtn = document.getElementById('shortBreakModeBtn');
    const longBreakModeBtn = document.getElementById('longBreakModeBtn');
    const totalFocusDisplay = document.getElementById('totalFocusDisplay');

    // Task UI
    const taskInput = document.getElementById('taskInput');
    const addTaskBtn = document.getElementById('addTaskBtn');
    const taskList = document.getElementById('taskList');

    // User Start Prompt overlay
    const audioStartModal = document.getElementById('audioStartModal');
    const startAppBtn = document.getElementById('startAppBtn');

    // Initialize sound engine & restore audio files
    await soundEngine.init();

    function setPlayButtonState(playing) {
        isGlobalPlaying = playing;
        if (masterPlayBtn) {
            if (playing) {
                masterPlayBtn.innerHTML = '<span>一時停止</span>';
                masterPlayBtn.className = 'bg-yellow-600 hover:bg-yellow-500 text-white text-xs px-3 py-2 rounded-lg font-bold flex items-center space-x-1 shadow-lg transition';
            } else {
                masterPlayBtn.innerHTML = '<span>BGM再生</span>';
                masterPlayBtn.className = 'bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-2 rounded-lg font-bold flex items-center space-x-1 shadow-lg transition';
            }
        }
    }

    function toggleGlobalPlay() {
        if (isGlobalPlaying) {
            soundEngine.stopAll();
            setPlayButtonState(false);
        } else {
            soundEngine.startAll();
            setPlayButtonState(true);
        }
    }

    startAppBtn.addEventListener('click', () => {
        audioStartModal.classList.add('hidden');
        soundEngine.init();
        soundEngine.stopAll();
        setPlayButtonState(false);
    });

    if (masterPlayBtn) {
        masterPlayBtn.addEventListener('click', () => {
            audioStartModal.classList.add('hidden');
            toggleGlobalPlay();
        });
    }

    if (crossfadeSelect) {
        crossfadeSelect.addEventListener('change', (e) => {
            soundEngine.setGlobalCrossfadeSec(parseFloat(e.target.value));
        });
    }

    // Render Sound Cards
    function renderSoundGrid() {
        soundGrid.innerHTML = '';

        soundEngine.channels.forEach(ch => {
            const st = soundEngine.states[ch.id] || { volume: 0, muted: false };
            const percentStr = (st.volume * 100).toFixed(1) + '%';
            const isPlaying = isGlobalPlaying && st.volume > 0 && !st.muted;

            const hasCustomAudio = !!(st.customFileName || st.customAudioUrl);
            const customTag = st.customFileName 
                ? `${st.customFileName}` 
                : (st.customAudioUrl ? '保存済み' : '音源差し替え');

            const card = document.createElement('div');
            card.className = `glass-card p-4 rounded-xl flex flex-col justify-between relative ${isPlaying ? 'active-playing' : ''}`;
            card.id = `card_${ch.id}`;

            card.innerHTML = `
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center space-x-2 truncate pr-2">
                        <span class="font-semibold text-sm text-slate-100 truncate" id="title_${ch.id}">${ch.name}</span>
                    </div>
                    <div class="flex items-center space-x-1 flex-shrink-0">
                        <button class="delete-ch-card-btn p-1 text-slate-400 hover:text-red-400 transition text-xs font-semibold" data-id="${ch.id}" title="この音源チャンネルを削除">
                            削除
                        </button>
                        <button class="edit-btn p-1 text-slate-400 hover:text-cyan-400 transition text-xs font-semibold" data-id="${ch.id}" title="名前を変更">
                            編集
                        </button>
                        <button class="solo-btn px-2 py-0.5 text-xs font-semibold rounded bg-slate-800 text-slate-400 hover:text-yellow-400 hover:bg-slate-700 transition" data-id="${ch.id}" title="ソロ再生（この音だけ再生）">
                            S
                        </button>
                        <button class="mute-btn p-1 text-xs font-semibold text-slate-400 hover:text-red-400 transition" data-id="${ch.id}" title="ミュート">
                            ${st.muted ? '消音中' : '消音'}
                        </button>
                    </div>
                </div>

                <div class="mt-2 mb-1 flex items-center space-x-2">
                    <button class="nudge-down-btn px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold transition" data-id="${ch.id}">-1%</button>
                    <input type="range" class="vol-slider flex-1" min="0" max="1" step="0.001" value="${st.volume}" data-id="${ch.id}">
                    <button class="nudge-up-btn px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold transition" data-id="${ch.id}">+1%</button>
                </div>

                <div class="flex items-center justify-between mt-2 text-xs text-slate-400 gap-1">
                    <span class="vol-val font-mono" id="volVal_${ch.id}">${percentStr}</span>
                    <div class="flex items-center space-x-1 truncate max-w-[180px] justify-end">
                        ${hasCustomAudio ? `
                            <button class="reset-audio-btn text-[10px] text-red-400 hover:text-red-300 transition px-1.5 py-0.5 rounded bg-red-950/60 border border-red-900/60 flex items-center space-x-0.5 flex-shrink-0" data-id="${ch.id}" title="差し替えた音源を削除して元に戻す">
                                削除
                            </button>
                        ` : ''}
                        <label class="cursor-pointer hover:text-cyan-400 flex items-center space-x-1 transition truncate" title="MP3/WAV音源をアップロードして保存">
                            <span class="truncate font-medium ${hasCustomAudio ? 'text-emerald-400 font-bold' : ''}" id="customLabel_${ch.id}">${customTag}</span>
                            <input type="file" class="hidden custom-file-input" accept="audio/*" data-id="${ch.id}">
                        </label>
                    </div>
                </div>
            `;

            soundGrid.appendChild(card);
        });

        if (restoreDefaultChannelsBtn) {
            if (soundEngine.hasDeletedDefaultChannels()) {
                restoreDefaultChannelsBtn.classList.remove('hidden');
            } else {
                restoreDefaultChannelsBtn.classList.add('hidden');
            }
        }

        attachCardEvents();
    }

    function showToast(msg, type = 'info') {
        const toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) return;
        const toast = document.createElement('div');
        toast.className = `glass-panel px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-100 shadow-2xl transition transform duration-300 pointer-events-auto border flex items-center space-x-2 ${type === 'danger' ? 'border-red-500/60 bg-red-950/90' : 'border-emerald-500/60 bg-slate-900/90'}`;
        toast.innerHTML = msg;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }

    function attachCardEvents() {
        // Delete sound channel from card button
        document.querySelectorAll('.delete-ch-card-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const id = btn.getAttribute('data-id') || e.currentTarget.getAttribute('data-id');
                const ch = soundEngine.channels.find(c => c.id === id);
                const name = ch ? ch.name : 'この音源';
                if (confirm(`音源チャンネル「${name}」を完全に削除しますか？`)) {
                    soundEngine.deleteChannel(id);
                    renderSoundGrid();
                    showToast(`音源「${name}」を削除しました`, 'danger');
                }
            });
        });

        // Reset custom audio file from card button
        document.querySelectorAll('.reset-audio-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const id = btn.getAttribute('data-id') || e.currentTarget.getAttribute('data-id');
                const ch = soundEngine.channels.find(c => c.id === id);
                const name = ch ? ch.name : 'この音源';
                if (confirm(`「${name}」に差し替えた音源を削除し、元の音源に戻しますか？`)) {
                    soundEngine.resetChannelAudio(id);
                    renderSoundGrid();
                    showToast(`「${name}」の音源を初期状態にリセットしました`);
                }
            });
        });

        // Range slider
        document.querySelectorAll('.vol-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                if (!isGlobalPlaying) {
                    soundEngine.startAll();
                    setPlayButtonState(true);
                }
                const id = e.target.getAttribute('data-id');
                const val = parseFloat(e.target.value);
                soundEngine.setChannelVolume(id, val);
                updateCardUI(id);
            });
        });

        // Nudge -1%
        document.querySelectorAll('.nudge-down-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (!isGlobalPlaying) {
                    soundEngine.startAll();
                    setPlayButtonState(true);
                }
                const id = e.target.getAttribute('data-id');
                soundEngine.nudgeChannelVolume(id, -0.01);
                updateCardUI(id);
            });
        });

        // Nudge +1%
        document.querySelectorAll('.nudge-up-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (!isGlobalPlaying) {
                    soundEngine.startAll();
                    setPlayButtonState(true);
                }
                const id = e.target.getAttribute('data-id');
                soundEngine.nudgeChannelVolume(id, 0.01);
                updateCardUI(id);
            });
        });

        // Mute
        document.querySelectorAll('.mute-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                soundEngine.toggleChannelMute(id);
                updateCardUI(id);
            });
        });

        // Solo
        document.querySelectorAll('.solo-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                soundEngine.toggleChannelSolo(id);
                soundEngine.channels.forEach(ch => updateCardUI(ch.id));
            });
        });

        // Edit Title Modal Trigger
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const ch = soundEngine.channels.find(c => c.id === id);
                if (!ch) return;

                const st = soundEngine.states[id];
                const hasCustomAudio = !!(st && (st.customFileName || st.customAudioUrl));

                editChId.value = id;
                editChName.value = ch.name;
                if (editChIcon) editChIcon.value = '';

                deleteChBtn.classList.remove('hidden');

                if (resetAudioChBtn) {
                    if (hasCustomAudio) {
                        resetAudioChBtn.classList.remove('hidden');
                    } else {
                        resetAudioChBtn.classList.add('hidden');
                    }
                }

                editChannelModal.classList.remove('hidden');
            });
        });

        // Custom File Input
        document.querySelectorAll('.custom-file-input').forEach(input => {
            input.addEventListener('change', async (e) => {
                const id = e.target.getAttribute('data-id');
                if (e.target.files && e.target.files[0]) {
                    const file = e.target.files[0];
                    const ch = soundEngine.channels.find(c => c.id === id);
                    const name = ch ? ch.name : '音源';

                    await soundEngine.loadCustomFile(id, file);
                    renderSoundGrid();
                    showToast(`「${name}」の音源ファイルを保存しました`);

                    if (!isGlobalPlaying) {
                        soundEngine.startAll();
                        setPlayButtonState(true);
                    }
                }
            });
        });
    }

    function updateCardUI(id) {
        const st = soundEngine.states[id];
        const card = document.getElementById(`card_${id}`);
        if (!card || !st) return;

        const slider = card.querySelector('.vol-slider');
        const volVal = card.querySelector(`#volVal_${id}`);
        const muteBtn = card.querySelector('.mute-btn');
        const soloBtn = card.querySelector('.solo-btn');

        if (slider) slider.value = st.volume;
        if (volVal) volVal.textContent = (st.volume * 100).toFixed(1) + '%';
        if (muteBtn) muteBtn.textContent = st.muted ? '消音中' : '消音';

        if (soloBtn) {
            if (soundEngine.soloChannelId === id) {
                soloBtn.className = 'solo-btn px-2 py-0.5 text-xs font-semibold rounded bg-yellow-500 text-black shadow';
            } else {
                soloBtn.className = 'solo-btn px-2 py-0.5 text-xs font-semibold rounded bg-slate-800 text-slate-400 hover:text-yellow-400';
            }
        }

        const isPlaying = isGlobalPlaying && st.volume > 0 && !st.muted;
        if (isPlaying) {
            card.classList.add('active-playing');
        } else {
            card.classList.remove('active-playing');
        }
    }

    // Modal Events: Add Channel
    openAddChannelBtn.addEventListener('click', () => {
        newChName.value = '';
        if (newChIcon) newChIcon.value = '';
        newChFile.value = '';
        addChannelModal.classList.remove('hidden');
    });

    [closeAddChannelModal, cancelAddChBtn].forEach(b => {
        b.addEventListener('click', () => {
            addChannelModal.classList.add('hidden');
        });
    });

    submitAddChBtn.addEventListener('click', async () => {
        const name = newChName.value.trim() || 'マイ音源';
        const icon = '';
        const file = newChFile.files && newChFile.files[0] ? newChFile.files[0] : null;

        await soundEngine.addCustomChannel(name, icon, file);
        addChannelModal.classList.add('hidden');
        renderSoundGrid();
        showToast(`音源「${name}」を追加・保存しました`);
        if (!isGlobalPlaying) {
            soundEngine.startAll();
            setPlayButtonState(true);
        }
    });

    // Modal Events: Edit Channel
    [closeEditChannelModal, cancelEditChBtn].forEach(b => {
        b.addEventListener('click', () => {
            editChannelModal.classList.add('hidden');
        });
    });

    submitEditChBtn.addEventListener('click', () => {
        const id = editChId.value;
        const name = editChName.value.trim();
        const icon = '';

        soundEngine.updateChannelMeta(id, name, icon);
        editChannelModal.classList.add('hidden');
        renderSoundGrid();
    });

    if (resetAudioChBtn) {
        resetAudioChBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const id = editChId.value;
            const ch = soundEngine.channels.find(c => c.id === id);
            const name = ch ? ch.name : 'このチャンネル';
            if (confirm(`「${name}」の差し替え音源を削除し、元の音源に戻しますか？`)) {
                soundEngine.resetChannelAudio(id);
                editChannelModal.classList.add('hidden');
                renderSoundGrid();
                showToast(`「${name}」の音源を初期状態にリセットしました`);
            }
        });
    }

    deleteChBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const id = editChId.value;
        const ch = soundEngine.channels.find(c => c.id === id);
        const name = ch ? ch.name : 'このチャンネル';
        if (confirm(`音源チャンネル「${name}」を完全に削除しますか？`)) {
            soundEngine.deleteChannel(id);
            editChannelModal.classList.add('hidden');
            renderSoundGrid();
            showToast(`音源「${name}」を削除しました`, 'danger');
        }
    });

    if (restoreDefaultChannelsBtn) {
        restoreDefaultChannelsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('削除したデフォルト環境音チャンネルをすべて復元しますか？')) {
                soundEngine.restoreAllDefaultChannels();
                renderSoundGrid();
                showToast('削除された初期音源をすべて復元しました');
            }
        });
    }

    // Master Controls
    masterVolumeRange.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        soundEngine.setMasterVolume(val);
        masterVolumeVal.textContent = Math.round(val * 100) + '%';
    });

    masterMuteBtn.addEventListener('click', () => {
        const muted = soundEngine.toggleMasterMute();
        masterMuteBtn.textContent = muted ? 'ミュート中' : '音量';
        masterMuteBtn.classList.toggle('text-red-400', muted);
    });

    // Preset Manager
    function updateActiveSoundsPreview() {
        if (!activeSoundsPreview) return;
        activeSoundsPreview.innerHTML = '';
        const activeChs = soundEngine.channels.filter(ch => {
            const st = soundEngine.states[ch.id];
            return st && st.volume > 0 && !st.muted;
        });

        if (activeChs.length === 0) {
            activeSoundsPreview.innerHTML = '<span class="text-slate-500 italic">現在再生中の音源はありません（すべての音量が0%です）</span>';
            return;
        }

        activeChs.forEach(ch => {
            const st = soundEngine.states[ch.id];
            const badge = document.createElement('span');
            badge.className = 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 px-2 py-0.5 rounded text-[11px] flex items-center space-x-1';
            badge.innerHTML = `<span>${ch.name}</span> <span class="font-mono text-emerald-400 font-bold">${Math.round(st.volume * 100)}%</span>`;
            activeSoundsPreview.appendChild(badge);
        });
    }

    function renderPresetModalList() {
        if (!presetCardsList) return;
        presetCardsList.innerHTML = '';

        const allPresets = [
            ...defaultPresets.map(p => ({ ...p, isDefault: true })),
            ...customPresets.map(p => ({ ...p, isDefault: false }))
        ];

        allPresets.forEach(preset => {
            const card = document.createElement('div');
            card.className = `p-3 rounded-xl border flex flex-col justify-between space-y-2 ${preset.id === currentPresetId ? 'bg-indigo-950/60 border-indigo-500/80 shadow-lg' : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'}`;

            const soundPills = Object.keys(preset.volumes)
                .filter(chId => preset.volumes[chId] > 0)
                .map(chId => {
                    const ch = soundEngine.channels.find(c => c.id === chId) || soundEngine.defaultChannels.find(c => c.id === chId);
                    const name = ch ? ch.name : chId;
                    const volPct = Math.round(preset.volumes[chId] * 100);
                    return `<span class="bg-slate-800/90 text-slate-300 border border-slate-700 px-1.5 py-0.5 rounded text-[10px]">${name} ${volPct}%</span>`;
                }).join(' ');

            card.innerHTML = `
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-2 truncate">
                        <span class="font-bold text-xs ${preset.isDefault ? 'text-slate-200' : 'text-cyan-300'}">${preset.name}</span>
                        ${preset.id === currentPresetId ? '<span class="text-[10px] bg-emerald-900/80 text-emerald-300 px-1.5 py-0.5 rounded font-bold">適用中</span>' : ''}
                    </div>
                    <div class="flex items-center space-x-1 flex-shrink-0">
                        <button class="apply-preset-btn px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow" data-id="${preset.id}">
                            適用再生
                        </button>
                        ${!preset.isDefault ? `
                            <button class="delete-preset-btn px-2 py-1 text-slate-400 hover:text-red-400 transition text-xs font-medium ml-1" data-id="${preset.id}" title="この組み合わせを削除">
                                削除
                            </button>
                        ` : ''}
                    </div>
                </div>
                <div class="flex flex-wrap gap-1">
                    ${soundPills || '<span class="text-[10px] text-slate-500 italic">全消音</span>'}
                </div>
            `;

            presetCardsList.appendChild(card);
        });

        document.querySelectorAll('.apply-preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const preset = defaultPresets.find(p => p.id === id) || customPresets.find(p => p.id === id);
                if (preset) {
                    applyPreset(preset);
                    if (!isGlobalPlaying) {
                        soundEngine.startAll();
                        setPlayButtonState(true);
                    }
                    if (presetModal) presetModal.classList.add('hidden');
                    showToast(`組み合わせ「${preset.name}」を適用・再生しました`);
                }
            });
        });

        document.querySelectorAll('.delete-preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const p = customPresets.find(p => p.id === id);
                if (p && confirm(`保存した組み合わせ「${p.name}」を削除しますか？`)) {
                    customPresets = customPresets.filter(item => item.id !== id);
                    const store = masterStore.load();
                    store.customPresets = customPresets;
                    if (store.lastPresetId === id) {
                        store.lastPresetId = defaultPresets[0].id;
                    }
                    masterStore.save(store);

                    if (currentPresetId === id) {
                        currentPresetId = defaultPresets[0].id;
                    }

                    populatePresets();
                    presetSelect.value = currentPresetId;
                    renderPresetModalList();
                    showToast(`組み合わせ「${p.name}」を削除しました`, 'danger');
                }
            });
        });
    }

    function openPresetManagerModal() {
        if (!presetModal) return;
        newPresetName.value = '';
        updateActiveSoundsPreview();
        renderPresetModalList();
        presetModal.classList.remove('hidden');
    }

    if (openPresetModalBtn) {
        openPresetModalBtn.addEventListener('click', () => {
            openPresetManagerModal();
        });
    }

    [closePresetModal, dismissPresetModalBtn].forEach(b => {
        if (b) {
            b.addEventListener('click', () => {
                presetModal.classList.add('hidden');
            });
        }
    });

    function saveCurrentPreset(name) {
        if (!name) return;

        const currentVols = {};
        soundEngine.channels.forEach(ch => {
            currentVols[ch.id] = soundEngine.states[ch.id] ? soundEngine.states[ch.id].volume : 0;
        });

        const newPreset = {
            id: 'custom_' + Date.now(),
            name: name,
            bg: bgSelect.value,
            volumes: currentVols
        };

        customPresets.push(newPreset);

        const store = masterStore.load();
        store.customPresets = customPresets;
        store.lastPresetId = newPreset.id;
        masterStore.save(store);

        populatePresets();
        presetSelect.value = newPreset.id;
        currentPresetId = newPreset.id;

        updateActiveSoundsPreview();
        renderPresetModalList();
        showToast(`組み合わせ「${name}」を保存しました`);
    }

    if (submitSavePresetBtn) {
        submitSavePresetBtn.addEventListener('click', () => {
            const name = newPresetName.value.trim() || 'マイ音量ミックス';
            saveCurrentPreset(name);
            newPresetName.value = '';
        });
    }

    savePresetBtn.addEventListener('click', () => {
        openPresetManagerModal();
    });

    if (deleteCurrentPresetBtn) {
        deleteCurrentPresetBtn.addEventListener('click', () => {
            const selectedId = presetSelect.value;
            const isDefault = defaultPresets.some(p => p.id === selectedId);
            if (isDefault) {
                showToast('初期プリセットは削除できません', 'danger');
                return;
            }
            const p = customPresets.find(item => item.id === selectedId);
            if (p && confirm(`選択中の組み合わせ「${p.name}」を削除しますか？`)) {
                customPresets = customPresets.filter(item => item.id !== selectedId);
                const store = masterStore.load();
                store.customPresets = customPresets;
                if (store.lastPresetId === selectedId) {
                    store.lastPresetId = defaultPresets[0].id;
                }
                masterStore.save(store);

                currentPresetId = defaultPresets[0].id;
                populatePresets();
                presetSelect.value = currentPresetId;
                renderPresetModalList();
                showToast(`組み合わせ「${p.name}」を削除しました`, 'danger');
            }
        });
    }

    function populatePresets() {
        presetSelect.innerHTML = '';

        const defGroup = document.createElement('optgroup');
        defGroup.label = '標準プリセット (4パターン)';
        defaultPresets.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name;
            defGroup.appendChild(opt);
        });
        presetSelect.appendChild(defGroup);

        if (customPresets.length > 0) {
            const customGroup = document.createElement('optgroup');
            customGroup.label = 'マイ保存プリセット';
            customPresets.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.name;
                customGroup.appendChild(opt);
            });
            presetSelect.appendChild(customGroup);
        }
    }

    function applyPreset(preset) {
        currentPresetId = preset.id;
        presetSelect.value = preset.id;

        Object.keys(preset.volumes).forEach(chId => {
            soundEngine.setChannelVolume(chId, preset.volumes[chId]);
            if (soundEngine.states[chId]) soundEngine.states[chId].muted = false;
        });

        if (preset.bg) {
            bgSelect.value = preset.bg;
            visualizer.setMode(preset.bg);
        }

        const store = masterStore.load();
        store.lastPresetId = preset.id;
        masterStore.save(store);

        soundEngine.channels.forEach(ch => updateCardUI(ch.id));
    }

    presetSelect.addEventListener('change', (e) => {
        const id = e.target.value;
        const preset = defaultPresets.find(p => p.id === id) || customPresets.find(p => p.id === id);
        if (preset) applyPreset(preset);
        if (!isGlobalPlaying) {
            soundEngine.startAll();
            setPlayButtonState(true);
        }
    });

    bgSelect.addEventListener('change', (e) => {
        visualizer.setMode(e.target.value);
    });

    // Focus Mode
    focusModeBtn.addEventListener('click', () => {
        uiOverlay.classList.add('focus-hidden');
        focusExitHint.classList.remove('hidden');

        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'f' || e.key === 'F') {
            uiOverlay.classList.remove('focus-hidden');
            focusExitHint.classList.add('hidden');
        }
    });

    focusExitHint.addEventListener('click', () => {
        uiOverlay.classList.remove('focus-hidden');
        focusExitHint.classList.add('hidden');
    });

    // Pomodoro Timer Logic
    function updateTimerDisplay() {
        const mins = Math.floor(timerRemaining / 60).toString().padStart(2, '0');
        const secs = (timerRemaining % 60).toString().padStart(2, '0');
        timerDisplay.textContent = `${mins}:${secs}`;
    }

    function updateTotalFocusDisplay() {
        const hrs = Math.floor(totalFocusSeconds / 3600);
        const mins = Math.floor((totalFocusSeconds % 3600) / 60);
        totalFocusDisplay.textContent = `${hrs}時間 ${mins}分`;
    }

    function setTimerMode(mode, durationMin) {
        timerMode = mode;
        timerDuration = durationMin * 60;
        timerRemaining = timerDuration;
        if (timerIsRunning) pauseTimer();

        [workModeBtn, shortBreakModeBtn, longBreakModeBtn].forEach(b => b.classList.remove('bg-emerald-600', 'text-white'));

        if (mode === 'work') workModeBtn.classList.add('bg-emerald-600', 'text-white');
        if (mode === 'shortBreak') shortBreakModeBtn.classList.add('bg-emerald-600', 'text-white');
        if (mode === 'longBreak') longBreakModeBtn.classList.add('bg-emerald-600', 'text-white');

        updateTimerDisplay();
    }

    function startTimer() {
        if (timerIsRunning) return;
        timerIsRunning = true;
        timerStartBtn.textContent = '一時停止';
        timerStartBtn.classList.replace('bg-emerald-600', 'bg-yellow-600');

        timerInterval = setInterval(() => {
            if (timerRemaining > 0) {
                timerRemaining--;
                if (timerMode === 'work') {
                    totalFocusSeconds++;
                    localStorage.setItem('ambient_total_focus_sec', totalFocusSeconds.toString());
                    updateTotalFocusDisplay();
                }
                updateTimerDisplay();
            } else {
                pauseTimer();
                soundEngine.playNotificationSound();
                alert(timerMode === 'work' ? '作業時間が終了しました！休憩に入りましょう。' : '休憩が終了しました！作業を再開しましょう。');
            }
        }, 1000);
    }

    function pauseTimer() {
        timerIsRunning = false;
        clearInterval(timerInterval);
        timerStartBtn.textContent = 'スタート';
        timerStartBtn.classList.replace('bg-yellow-600', 'bg-emerald-600');
    }

    timerStartBtn.addEventListener('click', () => {
        if (!isGlobalPlaying) {
            soundEngine.startAll();
            setPlayButtonState(true);
        }
        if (timerIsRunning) pauseTimer();
        else startTimer();
    });

    timerResetBtn.addEventListener('click', () => {
        pauseTimer();
        timerRemaining = timerDuration;
        updateTimerDisplay();
    });

    workModeBtn.addEventListener('click', () => setTimerMode('work', 25));
    shortBreakModeBtn.addEventListener('click', () => setTimerMode('shortBreak', 5));
    longBreakModeBtn.addEventListener('click', () => setTimerMode('longBreak', 15));

    // Task Manager
    function renderTasks() {
        taskList.innerHTML = '';
        tasks.forEach((t, idx) => {
            const li = document.createElement('li');
            li.className = 'flex items-center justify-between p-2 rounded bg-slate-800/60 border border-slate-700/50 text-sm';
            li.innerHTML = `
                <label class="flex items-center space-x-2 cursor-pointer flex-1">
                    <input type="checkbox" class="task-check rounded text-emerald-500" ${t.done ? 'checked' : ''} data-idx="${idx}">
                    <span class="${t.done ? 'line-through text-slate-500' : 'text-slate-200'}">${t.text}</span>
                </label>
                <button class="del-task-btn text-slate-500 hover:text-red-400 px-2" data-idx="${idx}">✕</button>
            `;
            taskList.appendChild(li);
        });

        document.querySelectorAll('.task-check').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const idx = parseInt(e.target.getAttribute('data-idx'), 10);
                tasks[idx].done = e.target.checked;
                saveTasks();
            });
        });

        document.querySelectorAll('.del-task-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.getAttribute('data-idx'), 10);
                tasks.splice(idx, 1);
                saveTasks();
            });
        });
    }

    function saveTasks() {
        localStorage.setItem('ambient_tasks', JSON.stringify(tasks));
        renderTasks();
    }

    addTaskBtn.addEventListener('click', () => {
        const text = taskInput.value.trim();
        if (!text) return;
        tasks.push({ text: text, done: false });
        taskInput.value = '';
        saveTasks();
    });

    taskInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addTaskBtn.click();
    });

    // Initial Setup
    renderSoundGrid();
    populatePresets();
    updateTimerDisplay();
    updateTotalFocusDisplay();
    renderTasks();

    const storedMaster = masterStore.load();
    const hasSavedVolumes = storedMaster.volumes && Object.keys(storedMaster.volumes).length > 0;

    if (hasSavedVolumes) {
        soundEngine.channels.forEach(ch => {
            updateCardUI(ch.id);
        });
        if (storedMaster.lastPresetId) {
            presetSelect.value = storedMaster.lastPresetId;
        }
    } else {
        applyPreset(defaultPresets[0]);
    }

    soundEngine.stopAll();
    setPlayButtonState(false);
});
