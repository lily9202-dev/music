"use strict";

// Keep the existing database and store names. Version 1 records remain valid;
// online downloads and user overrides are stored as additional fields/records.
const DATABASE_NAME = "personal-music-player";
const DATABASE_VERSION = 1;
const STORE_NAME = "songs";
const CATALOG_CACHE_ID = "__music-player:catalog-cache";
const LOOP_STORAGE_KEY = "personal-music-player.loop-mode";
const SHUFFLE_STORAGE_KEY = "personal-music-player.shuffle-enabled";
const LOOP_MODES = ["none", "all", "one"];
const MAX_TITLE_LENGTH = 180;
const COVER_LIMIT = 1024;

const elements = {
  importButton: document.querySelector("#importButton"),
  audioFiles: document.querySelector("#audioFiles"),
  coverFileInput: document.querySelector("#coverFileInput"),
  status: document.querySelector("#statusMessage"),
  songList: document.querySelector("#songList"),
  emptyState: document.querySelector("#emptyState"),
  emptyRefreshButton: document.querySelector("#emptyRefreshButton"),
  noResults: document.querySelector("#noResults"),
  songCount: document.querySelector("#songCount"),
  visibleCount: document.querySelector("#visibleCount"),
  searchForm: document.querySelector("#searchForm"),
  search: document.querySelector("#songSearch"),
  clearSearchButton: document.querySelector("#clearSearchButton"),
  resetSearchButton: document.querySelector("#resetSearchButton"),
  quickMenuButton: document.querySelector("#quickMenuButton"),
  quickActionsDialog: document.querySelector("#quickActionsDialog"),
  closeQuickActionsButton: document.querySelector("#closeQuickActionsButton"),
  downloadAllButton: document.querySelector("#downloadAllButton"),
  refreshPlaylistButton: document.querySelector("#refreshPlaylistButton"),
  downloadProgress: document.querySelector("#downloadProgress"),
  progressLabel: document.querySelector("#progressLabel"),
  progressCount: document.querySelector("#progressCount"),
  downloadProgressBar: document.querySelector("#downloadProgressBar"),
  audio: document.querySelector("#audioPlayer"),
  miniTrack: document.querySelector("#expandPlayerButton"),
  miniCover: document.querySelector("#miniCover"),
  miniTitle: document.querySelector("#miniTitle"),
  miniSubtitle: document.querySelector("#miniSubtitle"),
  miniPlayButton: document.querySelector("#miniPlayButton"),
  miniPlayIcon: document.querySelector("#miniPlayIcon"),
  miniNextButton: document.querySelector("#miniNextButton"),
  playerDialog: document.querySelector("#playerDialog"),
  closePlayerButton: document.querySelector("#closePlayerButton"),
  fullTitle: document.querySelector("#fullTitle"),
  fullCover: document.querySelector("#fullCover"),
  fullTrackTitle: document.querySelector("#fullTrackTitle"),
  fullTrackSource: document.querySelector("#fullTrackSource"),
  playButton: document.querySelector("#playButton"),
  playIcon: document.querySelector("#playIcon"),
  previousButton: document.querySelector("#previousButton"),
  nextButton: document.querySelector("#nextButton"),
  seekBar: document.querySelector("#seekBar"),
  elapsedTime: document.querySelector("#elapsedTime"),
  durationTime: document.querySelector("#durationTime"),
  shuffleButton: document.querySelector("#shuffleButton"),
  shuffleCaption: document.querySelector("#shuffleCaption"),
  repeatButton: document.querySelector("#repeatButton"),
  repeatCaption: document.querySelector("#repeatCaption"),
  repeatBadge: document.querySelector("#repeatBadge"),
  playbackStatus: document.querySelector("#playbackStatus"),
  infoButton: document.querySelector("#infoButton"),
  infoDialog: document.querySelector("#infoDialog"),
  closeInfoButton: document.querySelector("#closeInfoButton"),
  infoDoneButton: document.querySelector("#infoDoneButton"),
  offlineSupportNote: document.querySelector("#offlineSupportNote"),
  updateState: document.querySelector("#updateState"),
  applyUpdateButton: document.querySelector("#applyUpdateButton"),
  trackMenuDialog: document.querySelector("#trackMenuDialog"),
  trackMenuTitle: document.querySelector("#trackMenuTitle"),
  trackMenuSource: document.querySelector("#trackMenuSource"),
  trackActionList: document.querySelector("#trackActionList"),
  closeTrackMenuButton: document.querySelector("#closeTrackMenuButton"),
  coverPreviewDialog: document.querySelector("#coverPreviewDialog"),
  coverPreviewImage: document.querySelector("#coverPreviewImage"),
  coverPreviewError: document.querySelector("#coverPreviewError"),
  confirmCoverButton: document.querySelector("#confirmCoverButton"),
  cancelCoverButton: document.querySelector("#cancelCoverButton"),
  closeCoverPreviewButton: document.querySelector("#closeCoverPreviewButton")
};

const ICON_PATHS = {
  play: ["M8 5v14l11-7z"],
  pause: ["M7 5h4v14H7z", "M15 5h4v14h-4z"],
  next: ["M6 5v14l10-7z", "M18 5v14"],
  previous: ["M18 5v14L8 12z", "M6 5v14"],
  shuffle: ["M3 7h2.5c4.2 0 8.8 10 13 10H21", "m18 14 3 3-3 3", "M3 17h2.5c4.2 0 8.8-10 13-10H21", "m18 4 3 3-3 3"],
  repeat: ["M17 2 21 6l-4 4", "M3 11V9a3 3 0 0 1 3-3h15", "m7 22-4-4 4-4", "M21 13v2a3 3 0 0 1-3 3H3"],
  more: ["M5 12h.01", "M12 12h.01", "M19 12h.01"],
  close: ["m6 6 12 12", "M18 6 6 18"],
  upload: ["M12 16V4", "m12 4-4.5 4.5", "M12 4l4.5 4.5", "M5 14v5h14v-5"],
  download: ["M12 3v12", "m7 10 5 5 5-5", "M4 17v3h16v-3"],
  refresh: ["M20 7v5h-5", "M4 17v-5h5", "M5.5 9a7 7 0 0 1 11.9-2L20 12", "M4 12l2.6 5a7 7 0 0 0 11.9-2"],
  image: ["M4 5h16v14H4z", "m4 15 4-4 4 4 3-3 5 5", "M9 9h.01"],
  trash: ["M4 7h16", "M10 11v6", "M14 11v6", "M6 7l1 13h10l1-13", "M9 7V4h6v3"],
  check: ["m5 12 4 4L19 6"],
  cloud: ["M7 18a4 4 0 1 1 .8-7.9A5.5 5.5 0 0 1 18 9a4 4 0 1 1 0 9z"]
};

let database = null;
let songs = [];
let localSongs = [];
let catalogSongs = [];
let remoteRecords = new Map();
let currentSongId = null;
let currentObjectUrl = null;
let currentPlaybackWasAutomatic = false;
let autoFailedIds = new Set();
let playbackRequestToken = 0;
let coverObjectUrls = new Map();
let previewCoverUrl = null;
let pendingCoverBlob = null;
let pendingCoverSongId = null;
let actionSongId = null;
let loopMode = readLoopMode();
let shuffleEnabled = readShuffleSetting();
let shuffleUpcoming = [];
let shuffleHistory = [];
let downloadStates = new Map();
let importing = false;
let refreshingCatalog = false;
let downloadingAll = false;
let serviceWorkerRegistration = null;
let statusTimer = 0;
let statusVersion = 0;

function readLoopMode() {
  try {
    const stored = localStorage.getItem(LOOP_STORAGE_KEY);
    return LOOP_MODES.includes(stored) ? stored : "none";
  } catch {
    return "none";
  }
}

function readShuffleSetting() {
  try { return localStorage.getItem(SHUFFLE_STORAGE_KEY) === "true"; }
  catch { return false; }
}

function storeSetting(key, value) {
  try { localStorage.setItem(key, value); } catch { /* Playback still works without preference storage. */ }
}

function setStatus(message, kind = "info") {
  const version = ++statusVersion;
  window.clearTimeout(statusTimer);
  elements.status.textContent = message;
  elements.status.dataset.kind = kind;
  if (message) elements.playbackStatus.textContent = message;
  if (message && kind === "success") {
    statusTimer = window.setTimeout(() => {
      if (version !== statusVersion) return;
      elements.status.textContent = "";
      delete elements.status.dataset.kind;
    }, 3000);
  }
}

function storageErrorMessage(error) {
  if (error?.name === "QuotaExceededError" || error?.name === "NS_ERROR_DOM_QUOTA_REACHED") {
    return "此裝置的儲存空間不足；舊下載仍保留，請釋出空間後再試。";
  }
  return "無法保存到此裝置的音樂庫。請確認瀏覽器允許網站使用儲存空間，再重試。";
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("此瀏覽器不支援 IndexedDB。"));
      return;
    }
    let request;
    try { request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION); }
    catch (error) { reject(error); return; }

    request.onupgradeneeded = () => {
      // This branch only creates the old store on a genuinely new database.
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => {
      database = request.result;
      database.onversionchange = () => {
        database.close();
        database = null;
        setStatus("音樂庫版本已變更，請重新開啟播放器。", "error");
      };
      resolve(database);
    };
    request.onerror = () => reject(request.error || new Error("無法開啟本機音樂庫。"));
    request.onblocked = () => setStatus("資料庫正被其他分頁使用，請關閉其他播放器分頁後重試。", "error");
  });
}

function readAllRecords() {
  return new Promise((resolve, reject) => {
    if (!database) { reject(new Error("本機音樂庫尚未準備好。")); return; }
    let transaction;
    try { transaction = database.transaction(STORE_NAME, "readonly"); }
    catch (error) { reject(error); return; }
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error || new Error("讀取音樂庫失敗。"));
  });
}

function writeRecords(records) {
  return new Promise((resolve, reject) => {
    if (!database) { reject(new Error("本機音樂庫尚未準備好。")); return; }
    let transaction;
    try {
      transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      for (const record of records) store.put(record);
    } catch (error) { reject(error); return; }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("資料庫寫入失敗。"));
    transaction.onabort = () => reject(transaction.error || new Error("資料庫寫入已取消。"));
  });
}

function writeRecord(record) { return writeRecords([record]); }

function deleteRecord(id) {
  return new Promise((resolve, reject) => {
    if (!database) { reject(new Error("本機音樂庫尚未準備好。")); return; }
    let transaction;
    try {
      transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(id);
    } catch (error) { reject(error); return; }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("資料庫刪除失敗。"));
    transaction.onabort = () => reject(transaction.error || new Error("資料庫刪除已取消。"));
  });
}

function makeId() {
  return window.crypto && typeof window.crypto.randomUUID === "function"
    ? window.crypto.randomUUID()
    : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function makeIcon(name, className = "svg-icon") {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add(className);
  appendIcon(svg, name);
  return svg;
}

function appendIcon(svg, name) {
  const namespace = "http://www.w3.org/2000/svg";
  svg.dataset.icon = name;
  for (const pathData of ICON_PATHS[name] || []) {
    const path = document.createElementNS(namespace, "path");
    path.setAttribute("d", pathData);
    svg.append(path);
  }
}

function replaceIcon(svg, name) {
  svg.replaceChildren();
  appendIcon(svg, name);
}

function isOnlineSong(song) { return song?.source === "online"; }
function isLocalSong(song) { return song?.source === "local"; }
function hasAudioBlob(song) { return song?.audioBlob instanceof Blob && song.audioBlob.size > 0; }
function isDownloaded(song) { return isOnlineSong(song) && hasAudioBlob(song) && typeof song.downloadVersion === "string"; }
function isCurrentDownload(song) { return isDownloaded(song) && song.downloadVersion === song.version; }
function bySongId(id) { return songs.find((song) => song.id === id) || null; }
function currentSong() { return bySongId(currentSongId); }

function normalizeStoredRecord(record) {
  if (!record || typeof record.id !== "string" || record.recordType === "catalog-cache") return null;
  if (record.source === "online" || (typeof record.remoteId === "string" && record.id.startsWith("online:"))) {
    const remoteId = record.remoteId || record.id.slice("online:".length);
    return {
      ...record,
      id: `online:${remoteId}`,
      remoteId,
      source: "online",
      title: typeof record.userTitle === "string" ? record.userTitle : (record.title || record.manifestTitle || remoteId),
      sourceRemoved: Boolean(record.sourceRemoved)
    };
  }
  if (!hasAudioBlob(record)) return null;
  return {
    ...record,
    source: "local",
    title: typeof record.title === "string" ? record.title : "未命名歌曲",
    originalFileName: typeof record.originalFileName === "string" ? record.originalFileName : "本機音訊"
  };
}

function resolveRelativeAsset(path, manifestUrl, fieldName) {
  if (typeof path !== "string" || !path.trim() || path !== path.trim()) throw new Error(`${fieldName} 必須是非空的相對路徑。`);
  if (path.startsWith("/") || path.startsWith("\\") || /^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith("//") || /[?#]/.test(path)) {
    throw new Error(`${fieldName} 必須使用相對路徑，不能使用根路徑、網址、查詢字串或片段。`);
  }
  const base = new URL("./", manifestUrl);
  const resolved = new URL(path, manifestUrl);
  if (resolved.origin !== base.origin || !resolved.pathname.startsWith(base.pathname)) {
    throw new Error(`${fieldName} 必須留在此 GitHub Pages 專案目錄內。`);
  }
  return resolved.href;
}

function validateCatalog(data, manifestUrl) {
  if (!data || typeof data !== "object" || !Array.isArray(data.songs)) throw new Error("songs.json 格式錯誤，頂層必須包含 songs 陣列。");
  const seen = new Set();
  return data.songs.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`第 ${index + 1} 首歌曲資料不是物件。`);
    const { id, title, audioUrl, coverUrl, version } = entry;
    if (typeof id !== "string" || !id.trim() || id.length > 120) throw new Error(`第 ${index + 1} 首歌曲的 id 無效。`);
    if (seen.has(id)) throw new Error(`歌曲 id「${id}」重複，歌單未套用。`);
    seen.add(id);
    if (typeof title !== "string" || !title.trim() || title.trim().length > MAX_TITLE_LENGTH) throw new Error(`歌曲「${id}」的 title 無效。`);
    if (typeof version !== "string" || !version.trim()) throw new Error(`歌曲「${id}」缺少音訊 version。`);
    const resolvedAudioUrl = resolveRelativeAsset(audioUrl, manifestUrl, `歌曲「${id}」的 audioUrl`);
    const resolvedCoverUrl = coverUrl == null || coverUrl === "" ? null : resolveRelativeAsset(coverUrl, manifestUrl, `歌曲「${id}」的 coverUrl`);
    return { id, title: title.trim(), audioPath: audioUrl, audioUrl: resolvedAudioUrl, coverPath: coverUrl || null, coverUrl: resolvedCoverUrl, version: version.trim() };
  });
}

function catalogCacheRecord(entries) {
  return {
    id: CATALOG_CACHE_ID,
    recordType: "catalog-cache",
    manifestUrl: catalogManifestUrl().href,
    savedAt: new Date().toISOString(),
    entries: entries.map((song) => ({ id: song.id, title: song.title, audioUrl: song.audioPath, ...(song.coverPath ? { coverUrl: song.coverPath } : {}), version: song.version }))
  };
}

function getOfflineRemoteRecords() {
  return [...remoteRecords.values()].filter((song) => hasAudioBlob(song) || song.userTitle || song.customCoverBlob instanceof Blob);
}

function composeSongs() {
  const currentIds = new Set(catalogSongs.map((song) => song.remoteId));
  const archived = getOfflineRemoteRecords()
    .filter((song) => !currentIds.has(song.remoteId) && (song.sourceRemoved || song.id === currentSongId))
    .map((song) => ({ ...song, sourceRemoved: true }));
  songs = [...catalogSongs, ...archived, ...localSongs];
  reconcileShuffleQueue();
}

async function applyCatalog(entries, { persist = true } = {}) {
  const nextRemoteRecords = new Map(remoteRecords);
  const nextCatalog = [];
  const writes = [];
  const presentIds = new Set(entries.map((entry) => entry.id));

  for (const entry of entries) {
    const internalId = `online:${entry.id}`;
    const old = nextRemoteRecords.get(entry.id);
    const userTitle = typeof old?.userTitle === "string" ? old.userTitle : undefined;
    const next = {
      ...(old || {}),
      id: internalId,
      remoteId: entry.id,
      source: "online",
      manifestTitle: entry.title,
      title: userTitle || entry.title,
      userTitle,
      audioUrl: entry.audioUrl,
      audioPath: entry.audioPath,
      coverUrl: entry.coverUrl,
      coverPath: entry.coverPath,
      version: entry.version,
      sourceRemoved: false
    };
    nextCatalog.push(next);
    if (old) {
      nextRemoteRecords.set(entry.id, next);
      writes.push(next);
    }
  }

  for (const [remoteId, old] of nextRemoteRecords) {
    if (presentIds.has(remoteId)) continue;
    const keep = hasAudioBlob(old) || Boolean(old.userTitle) || old.customCoverBlob instanceof Blob || old.id === currentSongId;
    if (keep) {
      const archived = { ...old, sourceRemoved: true };
      nextRemoteRecords.set(remoteId, archived);
      writes.push(archived);
    }
  }

  if (persist && database) {
    // Manifest + changed records are committed together. A failed transaction
    // leaves the previous saved list and downloaded audio intact.
    writes.push(catalogCacheRecord(entries));
    await writeRecords(writes);
  }

  remoteRecords = nextRemoteRecords;
  catalogSongs = nextCatalog;
  composeSongs();
  renderLibrary();
}

function catalogManifestUrl() { return new URL("./songs.json", document.baseURI); }

async function refreshCatalog({ quiet = false } = {}) {
  if (refreshingCatalog) return false;
  refreshingCatalog = true;
  if (!quiet) setStatus("正在讀取最新線上歌單…", "working");
  try {
    const url = catalogManifestUrl();
    const response = await fetch(url.href, { cache: "no-store", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`songs.json 回應 HTTP ${response.status}。`);
    const raw = await response.json();
    const entries = validateCatalog(raw, url);
    await applyCatalog(entries, { persist: Boolean(database) });
    setStatus(`線上歌單已更新，共 ${entries.length} 首。`, "success");
    return true;
  } catch (error) {
    const fallback = catalogSongs.length ? "已繼續使用上次保存的線上歌單。" : "目前只顯示此裝置保存的歌曲。";
    setStatus(`無法更新線上歌單：${error.message || "網路連線失敗。"} ${fallback}`, "error");
    return false;
  } finally {
    refreshingCatalog = false;
  }
}

function hashHue(text) {
  let hash = 0;
  for (const character of String(text || "music")) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return Math.abs(hash) % 360;
}

function coverBlobForSong(song) {
  if (song?.customCoverBlob instanceof Blob) return song.customCoverBlob;
  if (isOnlineSong(song) && !navigator.onLine && song.downloadedCoverBlob instanceof Blob) return song.downloadedCoverBlob;
  return null;
}

function coverSource(song) {
  const blob = coverBlobForSong(song);
  if (blob) {
    const existing = coverObjectUrls.get(song.id);
    if (existing?.blob === blob) return existing.url;
    if (existing) URL.revokeObjectURL(existing.url);
    const url = URL.createObjectURL(blob);
    coverObjectUrls.set(song.id, { blob, url });
    return url;
  }
  const existing = coverObjectUrls.get(song?.id);
  if (existing) {
    URL.revokeObjectURL(existing.url);
    coverObjectUrls.delete(song.id);
  }
  return isOnlineSong(song) && navigator.onLine ? song.coverUrl : null;
}

function applyCover(element, song) {
  element.style.setProperty("--cover-hue", `${song ? hashHue(song.id) : 142}deg`);
  const source = song ? coverSource(song) : null;
  element.classList.toggle("has-cover", Boolean(source));
  element.style.backgroundImage = source ? `url("${source}")` : "";
}

function createListCover(song) {
  const cover = document.createElement("span");
  cover.className = "cover cover-list";
  cover.setAttribute("aria-hidden", "true");
  applyCover(cover, song);
  return cover;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const value = Math.floor(seconds);
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

function loopModeLabel(mode = loopMode) {
  if (mode === "all") return "全部循環";
  if (mode === "one") return "單曲循環";
  return "不循環";
}

function persistLoopMode() { storeSetting(LOOP_STORAGE_KEY, loopMode); }
function persistShuffleSetting() { storeSetting(SHUFFLE_STORAGE_KEY, String(shuffleEnabled)); }
function songIds() { return songs.map((song) => song.id); }

function shuffled(ids, avoidFirstId = null) {
  const result = ids.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  if (result.length > 1 && avoidFirstId && result[0] === avoidFirstId) {
    const other = 1 + Math.floor(Math.random() * (result.length - 1));
    [result[0], result[other]] = [result[other], result[0]];
  }
  return result;
}

function insertAtRandomPosition(queue, id) {
  if (queue.includes(id)) return;
  queue.splice(Math.floor(Math.random() * (queue.length + 1)), 0, id);
}

function reconcileShuffleQueue() {
  const valid = new Set(songIds());
  shuffleHistory = shuffleHistory.filter((id) => valid.has(id));
  shuffleUpcoming = shuffleUpcoming.filter((id, index, list) => valid.has(id) && id !== currentSongId && list.indexOf(id) === index);
  const accounted = new Set([...shuffleHistory, ...shuffleUpcoming, ...(currentSongId ? [currentSongId] : [])]);
  for (const id of valid) if (!accounted.has(id)) insertAtRandomPosition(shuffleUpcoming, id);
}

function isPlayableWithoutNetwork(song) {
  return isLocalSong(song) ? hasAudioBlob(song) : isDownloaded(song);
}

function isPlayableNow(song, automatic = false) {
  if (isPlayableWithoutNetwork(song)) return true;
  if (!isOnlineSong(song) || !song.audioUrl) return false;
  if (automatic && !navigator.onLine) return false;
  return navigator.onLine;
}

function offlineReason(song) {
  if (isOnlineSong(song) && !isDownloaded(song)) return "這首線上歌曲尚未下載。請連上網路播放，或先選「下載供離線收聽」。";
  return "此歌曲目前沒有可用的本機音訊。";
}

function releaseAudioUrl() {
  if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
  currentObjectUrl = null;
}

function setAudioSource(song, shouldPlay, automatic = false) {
  playbackRequestToken += 1;
  elements.audio.pause();
  elements.audio.removeAttribute("src");
  elements.audio.load();
  releaseAudioUrl();
  currentSongId = song.id;
  currentPlaybackWasAutomatic = automatic;
  try { elements.audio.currentTime = 0; } catch { /* load() resets the old timeline for a new source. */ }
  if (hasAudioBlob(song)) {
    currentObjectUrl = URL.createObjectURL(song.audioBlob);
    elements.audio.src = currentObjectUrl;
  } else if (isOnlineSong(song) && song.audioUrl) {
    elements.audio.src = song.audioUrl;
  }
  elements.audio.load();
  updatePlaybackUI();
  setPlaybackStatus("正在載入音訊…");
  if (shouldPlay) playCurrent();
}

function clearCurrentPlayback() {
  playbackRequestToken += 1;
  elements.audio.pause();
  elements.audio.removeAttribute("src");
  elements.audio.load();
  releaseAudioUrl();
  currentSongId = null;
  currentPlaybackWasAutomatic = false;
  elements.seekBar.value = "0";
  elements.seekBar.max = "0";
  updatePlaybackUI();
  setPlaybackStatus("準備就緒");
}

function selectSong(id, shouldPlay = true, source = "direct") {
  const song = bySongId(id);
  if (!song) return false;
  if (!isPlayableNow(song, source === "auto" || (source === "queue" && shuffleEnabled))) {
    setStatus(offlineReason(song), "error");
    return false;
  }
  if (currentSongId === id) {
    if (source === "direct" && shouldPlay) {
      if (elements.audio.error) setAudioSource(song, true, false);
      else togglePlayback();
    }
    return true;
  }
  if (shuffleEnabled && source === "direct") {
    if (currentSongId) shuffleHistory.push(currentSongId);
    shuffleUpcoming = shuffleUpcoming.filter((queuedId) => queuedId !== id);
  }
  setAudioSource(song, shouldPlay, source === "auto" || (source === "queue" && shuffleEnabled));
  updateCurrentIndicators();
  return true;
}

function playCurrent() {
  if (!currentSongId) { startFirstSong(); return; }
  const song = currentSong();
  if (!song) { clearCurrentPlayback(); return; }
  if (!hasAudioBlob(song) && !navigator.onLine) {
    setStatus(offlineReason(song), "error");
    return;
  }
  const requestToken = ++playbackRequestToken;
  let attempt;
  try { attempt = elements.audio.play(); }
  catch (error) { reportPlayFailure(error); return; }
  if (attempt?.then) attempt.then(() => {
    if (requestToken === playbackRequestToken) updatePlaybackUI();
  }).catch((error) => {
    if (requestToken !== playbackRequestToken || error?.name === "AbortError") return;
    reportPlayFailure(error);
  });
}

function reportPlayFailure(error) {
  if (error?.name === "AbortError") return;
  if (error?.name === "NotAllowedError") setStatus("瀏覽器需要使用者操作才能播放，請再按一次播放。", "error");
  else setStatus("播放失敗。請確認音訊格式、網路連線或下載狀態。", "error");
  updatePlaybackUI();
}

function togglePlayback() {
  if (!currentSongId) startFirstSong();
  else if (elements.audio.paused) {
    const song = currentSong();
    if (elements.audio.error && song) setAudioSource(song, true, false);
    else playCurrent();
  } else elements.audio.pause();
}

function recordCurrentInHistory() {
  if (shuffleEnabled && currentSongId) shuffleHistory.push(currentSongId);
}

function findNextRandom({ manual = false, failed = false } = {}) {
  if (!songs.length) return false;
  if (!currentSongId) {
    reconcileShuffleQueue();
    if (!shuffleUpcoming.length) shuffleUpcoming = shuffled(songIds());
  } else if (!shuffleUpcoming.length) {
    if (loopMode !== "all" || songs.length < 2) return false;
    shuffleUpcoming = shuffled(songIds(), currentSongId);
  }

  for (let attempts = 0; attempts < songs.length; attempts += 1) {
    const nextId = shuffleUpcoming.shift();
    if (!nextId) break;
    const candidate = bySongId(nextId);
    if (!candidate || (failed && autoFailedIds.has(nextId)) || !isPlayableNow(candidate, true)) continue;
    if (currentSongId && !failed) recordCurrentInHistory();
    return selectSong(nextId, true, manual ? "queue" : "auto");
  }
  reconcileShuffleQueue();
  return false;
}

function startFirstSong() {
  if (!songs.length) { setStatus("目前沒有歌曲。", "info"); return; }
  if (shuffleEnabled) {
    const started = findNextRandom({ manual: true });
    if (!started) setStatus("沒有可播放的歌曲；請連線播放線上歌曲，或先下載供離線收聽。", "error");
    return;
  }
  const first = songs.find((song) => isPlayableNow(song, true));
  if (!first) { setStatus("沒有可離線播放的歌曲。請連線播放或下載歌曲。", "error"); return; }
  selectSong(first.id, true, "queue");
}

function playNext() {
  if (!songs.length) return;
  if (shuffleEnabled) {
    if (!findNextRandom({ manual: true })) setStatus("沒有可播放的下一首歌曲。", "info");
    return;
  }
  if (!currentSongId) { startFirstSong(); return; }
  const index = songs.findIndex((song) => song.id === currentSongId);
  if (index >= 0 && index < songs.length - 1) selectSong(songs[index + 1].id, true, "queue");
  else if (index === songs.length - 1 && loopMode === "all" && songs.length > 1) selectSong(songs[0].id, true, "queue");
}

function playPrevious() {
  if (!songs.length || !currentSongId) return;
  if (shuffleEnabled && shuffleHistory.length) {
    let previousId = null;
    while (shuffleHistory.length && !previousId) {
      const candidateId = shuffleHistory.pop();
      if (isPlayableNow(bySongId(candidateId), true)) previousId = candidateId;
    }
    if (previousId) {
      shuffleUpcoming.unshift(currentSongId);
      selectSong(previousId, true, "queue");
    }
    return;
  }
  if (elements.audio.currentTime > 3) { elements.audio.currentTime = 0; return; }
  if (shuffleEnabled) return;
  const index = songs.findIndex((song) => song.id === currentSongId);
  if (index > 0) selectSong(songs[index - 1].id, true, "queue");
  else if (index === 0 && loopMode === "all" && songs.length > 1) selectSong(songs[songs.length - 1].id, true, "queue");
}

function advanceLinearAutomatically(startAfterIndex = null) {
  if (!songs.length) return false;
  const currentIndex = startAfterIndex == null ? songs.findIndex((song) => song.id === currentSongId) : startAfterIndex;
  for (let offset = 1; offset <= songs.length; offset += 1) {
    let index = currentIndex + offset;
    if (index >= songs.length) {
      if (loopMode !== "all") break;
      index %= songs.length;
    }
    const candidate = songs[index];
    if (candidate.id === currentSongId || autoFailedIds.has(candidate.id) || !isPlayableNow(candidate, true)) continue;
    return selectSong(candidate.id, true, "auto");
  }
  return false;
}

function handleNaturalEnd() {
  if (!currentSongId) return;
  if (loopMode === "one" || (loopMode === "all" && songs.length === 1)) {
    try { elements.audio.currentTime = 0; } catch { /* The next play will reload metadata if needed. */ }
    playCurrent();
    return;
  }
  const advanced = shuffleEnabled ? findNextRandom() : advanceLinearAutomatically();
  if (!advanced) {
    updatePlaybackUI();
    setPlaybackStatus(navigator.onLine ? "播放佇列已結束" : "沒有可離線播放的下一首歌曲。下載歌曲後即可離線接續播放。");
  }
}

function handleAutomaticLoadFailure() {
  if (!currentPlaybackWasAutomatic || !currentSongId) return;
  const failedId = currentSongId;
  autoFailedIds.add(failedId);
  const advanced = shuffleEnabled ? findNextRandom({ failed: true }) : advanceLinearAutomatically(songs.findIndex((song) => song.id === failedId));
  if (!advanced) {
    currentPlaybackWasAutomatic = false;
    setPlaybackStatus("佇列中沒有其他可播放歌曲；請檢查音訊網址或網路連線。");
  }
}

function canPlayNext() {
  if (!songs.length) return false;
  if (!currentSongId) return songs.some((song) => isPlayableNow(song, true));
  if (shuffleEnabled) return shuffleUpcoming.some((id) => isPlayableNow(bySongId(id), true)) || (loopMode === "all" && songs.length > 1);
  const index = songs.findIndex((song) => song.id === currentSongId);
  return songs.slice(index + 1).some((song) => isPlayableNow(song, true)) || (loopMode === "all" && songs.length > 1);
}

function updateModeControls() {
  const shuffleLabel = shuffleEnabled ? "隨機播放，開啟" : "隨機播放，關閉";
  elements.shuffleButton.setAttribute("aria-pressed", String(shuffleEnabled));
  elements.shuffleButton.setAttribute("aria-label", shuffleLabel);
  elements.shuffleButton.title = shuffleLabel;
  elements.shuffleCaption.textContent = shuffleEnabled ? "隨機開" : "隨機關";
  elements.shuffleButton.classList.toggle("is-active", shuffleEnabled);
  const loopLabel = `循環模式：${loopModeLabel()}`;
  elements.repeatButton.setAttribute("aria-pressed", String(loopMode !== "none"));
  elements.repeatButton.setAttribute("aria-label", loopLabel);
  elements.repeatButton.title = `${loopLabel}，按一下切換`;
  elements.repeatCaption.textContent = loopModeLabel();
  elements.repeatButton.classList.toggle("is-active", loopMode !== "none");
  elements.repeatButton.classList.toggle("is-loop-one", loopMode === "one");
  elements.repeatBadge.hidden = loopMode !== "one";
}

function updateButtonState() {
  const hasSongs = songs.length > 0;
  const hasCurrent = Boolean(currentSong());
  elements.miniTrack.disabled = !hasSongs;
  elements.miniPlayButton.disabled = !hasSongs;
  elements.miniNextButton.disabled = !canPlayNext();
  elements.playButton.disabled = !hasSongs;
  elements.previousButton.disabled = !hasCurrent;
  elements.nextButton.disabled = !canPlayNext();
  const paused = elements.audio.paused;
  elements.playButton.setAttribute("aria-label", paused ? "播放" : "暫停");
  elements.playButton.title = paused ? "播放" : "暫停";
  elements.miniPlayButton.setAttribute("aria-label", paused ? "播放" : "暫停");
  elements.miniPlayButton.title = paused ? "播放" : "暫停";
  replaceIcon(elements.playIcon, paused ? "play" : "pause");
  replaceIcon(elements.miniPlayIcon, paused ? "play" : "pause");
  elements.seekBar.disabled = !hasCurrent || !Number.isFinite(elements.audio.duration);
}

function updateCurrentIndicators() {
  const stateText = !currentSongId ? "" : elements.audio.ended ? "已結束" : elements.audio.paused ? "已暫停" : "播放中";
  for (const row of elements.songList.querySelectorAll(".song-row")) {
    const active = row.dataset.songId === currentSongId;
    row.classList.toggle("is-current", active);
    const button = row.querySelector(".song-select");
    if (button) {
      if (active) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    }
    const state = row.querySelector(".song-state");
    if (state) { state.textContent = active ? stateText : ""; state.hidden = !active; }
    const indicator = row.querySelector(".current-indicator");
    if (indicator) {
      indicator.replaceChildren(makeIcon(active && !elements.audio.paused ? "pause" : "play", "indicator-icon"));
      indicator.hidden = !active;
    }
  }
}

function updateTimeline() {
  const current = Number.isFinite(elements.audio.currentTime) ? elements.audio.currentTime : 0;
  const duration = Number.isFinite(elements.audio.duration) ? elements.audio.duration : 0;
  if (!elements.seekBar.matches(":active")) elements.seekBar.value = String(current);
  elements.seekBar.max = String(duration);
  elements.elapsedTime.textContent = formatTime(current);
  elements.durationTime.textContent = formatTime(duration);
  updateButtonState();
}

function downloadStateFor(song) {
  const transient = downloadStates.get(song.id);
  if (transient?.state === "downloading") return { state: "downloading", label: "下載中…" };
  if (transient?.state === "failed") {
    return isDownloaded(song)
      ? { state: "newer", label: "有新版・更新失敗" }
      : { state: "failed", label: "下載失敗" };
  }
  if (song.sourceRemoved) return { state: "removed", label: isDownloaded(song) ? "來源已移除・已下載" : "來源已移除" };
  if (isDownloaded(song) && song.downloadVersion !== song.version) return { state: "newer", label: "有新版" };
  if (isDownloaded(song)) return { state: "downloaded", label: "已下載" };
  if (!navigator.onLine) return { state: "offline", label: "未下載・需連網或下載" };
  return { state: "missing", label: "未下載" };
}

function updatePlaybackUI() {
  const song = currentSong();
  elements.miniTitle.textContent = song ? song.title : "選擇一首歌曲";
  elements.miniSubtitle.textContent = song
    ? `${isLocalSong(song) ? "本機匯入" : "線上歌單"} · ${elements.audio.ended ? "播放佇列已結束" : elements.audio.paused ? "已暫停" : "正在播放"}`
    : "音樂庫";
  elements.fullTitle.textContent = song ? "正在播放" : "播放頁";
  elements.fullTrackTitle.textContent = song ? song.title : "尚未選擇歌曲";
  if (!song) elements.fullTrackSource.textContent = "選擇音樂庫中的歌曲開始播放";
  else if (isLocalSong(song)) elements.fullTrackSource.textContent = `本機匯入 · ${song.originalFileName}`;
  else elements.fullTrackSource.textContent = song.sourceRemoved ? "線上來源已移除 · 已保存的歌曲仍可播放" : `線上歌單 · ${downloadStateFor(song).label}`;
  applyCover(elements.miniCover, song);
  applyCover(elements.fullCover, song);
  updateTimeline();
  updateCurrentIndicators();
  updateModeControls();
}

function sourceLabel(song) {
  if (isLocalSong(song)) return "本機匯入";
  return song.sourceRemoved ? "來源已移除" : "線上歌單";
}

function createSongRow(song) {
  const row = document.createElement("article");
  row.className = "song-row";
  row.dataset.songId = song.id;
  if (song.id === currentSongId) row.classList.add("is-current");

  const info = document.createElement("div");
  info.className = "song-info";
  const select = document.createElement("button");
  select.type = "button";
  select.className = "song-select";
  select.setAttribute("aria-label", `播放：${song.title}，來源：${sourceLabel(song)}`);
  if (song.id === currentSongId) select.setAttribute("aria-current", "true");
  const copy = document.createElement("span");
  copy.className = "song-copy";
  const title = document.createElement("span");
  title.className = "song-name";
  title.textContent = song.title;
  const sub = document.createElement("span");
  sub.className = "song-filename";
  sub.textContent = isLocalSong(song) ? song.originalFileName : (song.sourceRemoved ? "此歌曲已從線上歌單移除" : "");
  const state = document.createElement("span");
  state.className = "song-state";
  state.hidden = song.id !== currentSongId;
  state.textContent = song.id === currentSongId ? (elements.audio.paused ? "已暫停" : "播放中") : "";
  const meta = document.createElement("span");
  meta.className = "song-meta";
  const origin = document.createElement("span");
  origin.className = `song-origin${song.sourceRemoved ? " source-removed" : ""}`;
  origin.textContent = sourceLabel(song);
  meta.append(origin);
  if (isOnlineSong(song)) {
    const download = document.createElement("span");
    const downloadState = downloadStateFor(song);
    download.className = "download-state";
    download.dataset.state = downloadState.state;
    download.textContent = downloadState.label;
    meta.append(download);
  }
  copy.append(title, sub, state, meta);
  const indicator = document.createElement("span");
  indicator.className = "current-indicator";
  indicator.hidden = song.id !== currentSongId;
  indicator.append(makeIcon(song.id === currentSongId && !elements.audio.paused ? "pause" : "play", "indicator-icon"));
  select.append(copy, indicator);
  select.addEventListener("click", () => selectSong(song.id, true, "direct"));
  info.append(select);

  const more = document.createElement("button");
  more.className = "icon-button more-button";
  more.type = "button";
  more.setAttribute("aria-label", `更多歌曲選項：${song.title}`);
  more.setAttribute("aria-haspopup", "dialog");
  more.append(makeIcon("more"));
  more.addEventListener("click", () => openTrackMenu(song.id));
  row.append(createListCover(song), info, more);
  return row;
}

function renderLibrary(focusRename = false) {
  const query = elements.search.value.trim().toLocaleLowerCase();
  const visible = songs.filter((song) => !query || song.title.toLocaleLowerCase().includes(query));
  elements.songList.replaceChildren(...visible.map(createSongRow));
  elements.songCount.textContent = `${songs.length} 首歌曲`;
  elements.visibleCount.textContent = query ? `顯示 ${visible.length} 首` : "";
  elements.emptyState.hidden = songs.length > 0;
  elements.noResults.hidden = songs.length === 0 || visible.length > 0;
  elements.clearSearchButton.hidden = !elements.search.value;
  updatePlaybackUI();
  if (focusRename) requestAnimationFrame(() => document.querySelector(".rename-input")?.focus());
}

function openDialog(dialog) { if (!dialog.open) dialog.showModal(); }
function closeDialog(dialog) { if (dialog.open) dialog.close(); }

function addMenuAction({ label, icon, onClick, disabled = false, danger = false, note = "" }) {
  const button = document.createElement("button");
  button.className = `action-item${danger ? " action-delete" : ""}`;
  button.type = "button";
  button.disabled = disabled;
  button.append(makeIcon(icon));
  const text = document.createElement("span");
  text.textContent = label;
  button.append(text);
  if (note) {
    const hint = document.createElement("span");
    hint.className = "action-note";
    hint.textContent = note;
    button.append(hint);
  }
  button.addEventListener("click", onClick);
  elements.trackActionList.append(button);
}

function openTrackMenu(id) {
  const song = bySongId(id);
  if (!song) return;
  actionSongId = id;
  elements.trackMenuTitle.textContent = song.title;
  elements.trackMenuSource.textContent = sourceLabel(song);
  elements.trackActionList.replaceChildren();
  addMenuAction({ label: "修改歌名", icon: "image", onClick: beginRename });
  addMenuAction({ label: "更換封面", icon: "image", onClick: beginCoverChange });
  if (song.customCoverBlob instanceof Blob) addMenuAction({ label: "移除自訂封面", icon: "close", onClick: () => removeCustomCover(id) });
  if (isOnlineSong(song)) {
    const status = downloadStateFor(song);
    addMenuAction({
      label: isDownloaded(song) ? "更新離線檔案" : "下載供離線收聽",
      icon: "download",
      disabled: status.state === "downloading" || isCurrentDownload(song),
      note: isCurrentDownload(song) ? "已是最新" : "",
      onClick: () => { closeDialog(elements.trackMenuDialog); downloadSong(id); }
    });
    if (isDownloaded(song)) addMenuAction({ label: "移除離線檔案", icon: "trash", danger: true, onClick: () => removeOfflineAudio(id) });
  } else {
    addMenuAction({ label: "刪除本機歌曲", icon: "trash", danger: true, onClick: () => deleteLocalSong(id) });
  }
  openDialog(elements.trackMenuDialog);
}

function beginRename() {
  const id = actionSongId;
  closeDialog(elements.trackMenuDialog);
  const song = bySongId(id);
  if (!song) return;
  const row = [...elements.songList.querySelectorAll(".song-row")].find((item) => item.dataset.songId === id);
  if (!row) { elements.search.value = ""; renderLibrary(); return beginRenameFor(id); }
  beginRenameFor(id);
}

function beginRenameFor(id) {
  const song = bySongId(id);
  const row = [...elements.songList.querySelectorAll(".song-row")].find((item) => item.dataset.songId === id);
  if (!song || !row) return;
  const info = row.querySelector(".song-info");
  info.replaceChildren();
  const form = document.createElement("form");
  form.className = "rename-form";
  const input = document.createElement("input");
  input.className = "rename-input";
  input.type = "text";
  input.maxLength = MAX_TITLE_LENGTH;
  input.value = song.title;
  input.setAttribute("aria-label", `修改歌名：${song.title}`);
  const save = document.createElement("button");
  save.className = "text-button rename-save";
  save.type = "submit";
  save.textContent = "儲存";
  const cancel = document.createElement("button");
  cancel.className = "text-button";
  cancel.type = "button";
  cancel.textContent = "取消";
  cancel.addEventListener("click", renderLibrary);
  form.append(input, save, cancel);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = input.value.trim();
    if (!title) { setStatus("歌名不能留白。", "error"); input.focus(); return; }
    const changed = isOnlineSong(song) ? { ...song, title, userTitle: title } : { ...song, title, source: "local" };
    try {
      await writeRecord(changed);
      replaceSong(changed);
      if (isOnlineSong(changed)) remoteRecords.set(changed.remoteId, changed);
      renderLibrary();
      setStatus("歌名已保存。", "success");
    } catch (error) { setStatus(storageErrorMessage(error), "error"); }
  });
  form.addEventListener("keydown", (event) => { if (event.key === "Escape") renderLibrary(); });
  info.append(form);
  input.focus();
  input.select();
}

function replaceSong(updated) {
  songs = songs.map((song) => song.id === updated.id ? updated : song);
  localSongs = localSongs.map((song) => song.id === updated.id ? updated : song);
  if (isOnlineSong(updated)) remoteRecords.set(updated.remoteId, updated);
  catalogSongs = catalogSongs.map((song) => song.id === updated.id ? updated : song);
}

async function deleteLocalSong(id) {
  const song = bySongId(id);
  closeDialog(elements.trackMenuDialog);
  if (!song || !window.confirm(`確定要刪除「${song.title}」嗎？此動作無法復原。`)) return;
  try {
    await deleteRecord(id);
    if (currentSongId === id) clearCurrentPlayback();
    const cover = coverObjectUrls.get(id);
    if (cover) URL.revokeObjectURL(cover.url);
    coverObjectUrls.delete(id);
    localSongs = localSongs.filter((item) => item.id !== id);
    songs = songs.filter((item) => item.id !== id);
    shuffleUpcoming = shuffleUpcoming.filter((item) => item !== id);
    shuffleHistory = shuffleHistory.filter((item) => item !== id);
    reconcileShuffleQueue();
    renderLibrary();
    setStatus(`已刪除「${song.title}」。`, "success");
  } catch (error) { setStatus(storageErrorMessage(error), "error"); }
}

function beginCoverChange() {
  const id = actionSongId;
  closeDialog(elements.trackMenuDialog);
  pendingCoverSongId = id;
  elements.coverFileInput.value = "";
  elements.coverFileInput.click();
}

function decodeImage(blob) {
  if (typeof createImageBitmap === "function") return createImageBitmap(blob);
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("圖片無法解碼。")); };
    image.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function cropCoverImage(file) {
  if (!(file instanceof Blob) || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("封面只支援 JPEG、PNG 或 WebP 圖片。請確認檔案格式。 ");
  }
  const image = await decodeImage(file);
  try {
    const width = image.width || image.naturalWidth;
    const height = image.height || image.naturalHeight;
    if (!width || !height) throw new Error("圖片尺寸無效，無法製作封面。");
    const crop = Math.min(width, height);
    const size = Math.min(COVER_LIMIT, crop);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("瀏覽器無法建立圖片預覽。");
    context.drawImage(image, (width - crop) / 2, (height - crop) / 2, crop, crop, 0, 0, size, size);
    let result = await canvasToBlob(canvas, "image/webp", .88);
    if (!result) result = await canvasToBlob(canvas, "image/jpeg", .9);
    if (!result) throw new Error("圖片縮放失敗，請改用其他圖片。");
    return result;
  } finally {
    if (typeof image.close === "function") image.close();
  }
}

function cleanCoverPreview() {
  if (previewCoverUrl) URL.revokeObjectURL(previewCoverUrl);
  previewCoverUrl = null;
  pendingCoverBlob = null;
  pendingCoverSongId = null;
  elements.coverPreviewImage.removeAttribute("src");
  elements.confirmCoverButton.disabled = true;
  elements.confirmCoverButton.textContent = "保存封面";
}

async function prepareCoverPreview(file) {
  elements.coverPreviewError.textContent = "";
  elements.confirmCoverButton.disabled = true;
  if (!file) return;
  try {
    const blob = await cropCoverImage(file);
    pendingCoverBlob = blob;
    if (previewCoverUrl) URL.revokeObjectURL(previewCoverUrl);
    previewCoverUrl = URL.createObjectURL(blob);
    elements.coverPreviewImage.src = previewCoverUrl;
    elements.confirmCoverButton.disabled = false;
    openDialog(elements.coverPreviewDialog);
  } catch (error) {
    elements.coverPreviewError.textContent = error.message || "圖片無法解碼，請選擇其他圖片。";
    openDialog(elements.coverPreviewDialog);
  }
}

async function confirmCoverChange() {
  const song = bySongId(pendingCoverSongId);
  if (!song || !pendingCoverBlob) return;
  elements.confirmCoverButton.disabled = true;
  elements.confirmCoverButton.textContent = "保存中…";
  try {
    const updated = { ...song, customCoverBlob: pendingCoverBlob, customCoverType: pendingCoverBlob.type || "image/webp" };
    await writeRecord(updated);
    replaceSong(updated);
    renderLibrary();
    closeDialog(elements.coverPreviewDialog);
    setStatus("自訂封面已保存到此裝置。", "success");
  } catch (error) {
    elements.confirmCoverButton.disabled = false;
    elements.confirmCoverButton.textContent = "保存封面";
    elements.coverPreviewError.textContent = storageErrorMessage(error);
  }
}

async function removeCustomCover(id) {
  closeDialog(elements.trackMenuDialog);
  const song = bySongId(id);
  if (!song || !(song.customCoverBlob instanceof Blob)) return;
  try {
    const updated = { ...song, customCoverBlob: null, customCoverType: null };
    await writeRecord(updated);
    replaceSong(updated);
    renderLibrary();
    setStatus("已移除自訂封面。", "success");
  } catch (error) { setStatus(storageErrorMessage(error), "error"); }
}

function responseMime(response, blob) {
  return (response.headers.get("content-type") || blob.type || "").split(";")[0].trim().toLowerCase();
}

async function fetchRemoteAudio(song) {
  const response = await fetch(song.audioUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`音訊下載失敗（HTTP ${response.status}）。`);
  const blob = await response.blob();
  const type = responseMime(response, blob);
  if (!type.startsWith("audio/")) throw new Error(`伺服器回傳 ${type || "未知內容"}，不是音訊檔。`);
  if (!blob.size) throw new Error("下載到的音訊是空檔案。");
  return blob.type === type ? blob : blob.slice(0, blob.size, type);
}

async function fetchRemoteCover(song) {
  if (!song.coverUrl) return null;
  const response = await fetch(song.coverUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`封面下載失敗（HTTP ${response.status}）。`);
  const blob = await response.blob();
  const type = responseMime(response, blob);
  if (!["image/jpeg", "image/png", "image/webp"].includes(type) || !blob.size) throw new Error("線上封面不是可用的 JPEG、PNG 或 WebP 圖片。");
  const decoded = await decodeImage(blob);
  if (typeof decoded.close === "function") decoded.close();
  return blob.type === type ? blob : blob.slice(0, blob.size, type);
}

async function downloadSong(id) {
  const song = bySongId(id);
  if (!isOnlineSong(song)) return false;
  if (isCurrentDownload(song)) {
    setStatus(`「${song.title}」已是目前版本，不需重複下載。`, "success");
    return true;
  }
  if (downloadStates.get(id)?.state === "downloading") return false;
  downloadStates.set(id, { state: "downloading" });
  renderLibrary();
  setStatus(`正在下載「${song.title}」…`, "working");
  try {
    const [audioBlob, downloadedCoverBlob] = await Promise.all([fetchRemoteAudio(song), fetchRemoteCover(song)]);
    // The old record (including its audio Blob) is replaced only after the
    // entire new payload has been fetched and this transaction commits.
    const updated = {
      ...song,
      audioBlob,
      downloadVersion: song.version,
      downloadedAt: new Date().toISOString(),
      downloadedTitle: song.manifestTitle,
      downloadedAudioUrl: song.audioUrl,
      downloadedCoverBlob,
      downloadedCoverUrl: song.coverUrl || null
    };
    await writeRecord(updated);
    replaceSong(updated);
    downloadStates.delete(id);
    renderLibrary();
    setStatus(`「${song.title}」已保存供離線收聽。`, "success");
    return true;
  } catch (error) {
    downloadStates.set(id, { state: "failed", message: error.message || storageErrorMessage(error) });
    renderLibrary();
    const reason = error?.name === "QuotaExceededError" ? storageErrorMessage(error) : (error.message || "網路或儲存失敗。");
    setStatus(`「${song.title}」下載失敗：${reason}`, "error");
    return false;
  }
}

async function removeOfflineAudio(id) {
  closeDialog(elements.trackMenuDialog);
  const song = bySongId(id);
  if (!isDownloaded(song)) return;
  try {
    const updated = { ...song, audioBlob: null, downloadVersion: null, downloadedAt: null, downloadedTitle: null, downloadedAudioUrl: null, downloadedCoverBlob: null, downloadedCoverUrl: null };
    await writeRecord(updated);
    replaceSong(updated);
    downloadStates.delete(id);
    renderLibrary();
    setStatus(`已移除「${song.title}」的離線音訊；線上歌單與自訂資訊仍保留。`, "success");
  } catch (error) { setStatus(storageErrorMessage(error), "error"); }
}

async function downloadAllSongs() {
  if (downloadingAll) return;
  const candidates = catalogSongs.filter((song) => !isCurrentDownload(song));
  if (!candidates.length) { setStatus("線上歌單中的歌曲都已下載至目前版本。", "success"); return; }
  downloadingAll = true;
  elements.downloadAllButton.disabled = true;
  elements.downloadProgress.hidden = false;
  elements.downloadProgressBar.max = candidates.length;
  elements.downloadProgressBar.value = 0;
  let completed = 0;
  let failed = 0;
  for (const song of candidates) {
    elements.progressLabel.textContent = `正在下載：${song.title}`;
    elements.progressCount.textContent = `${completed}/${candidates.length}`;
    setStatus(`全部下載 ${completed + 1}/${candidates.length}：${song.title}`, "working");
    if (!await downloadSong(song.id)) failed += 1;
    completed += 1;
    elements.progressCount.textContent = `${completed}/${candidates.length}`;
    elements.downloadProgressBar.value = completed;
  }
  elements.progressLabel.textContent = failed ? `完成 ${completed - failed} 首，${failed} 首失敗` : `已完成 ${completed} 首`;
  elements.downloadAllButton.disabled = false;
  downloadingAll = false;
  setStatus(failed ? `全部下載完成：${completed - failed} 首成功、${failed} 首失敗。` : `全部下載完成，共 ${completed} 首。`, failed ? "error" : "success");
}

function extensionFor(name) { return (/\.([^.]+)$/.exec(name)?.[1] || "").toLowerCase(); }

function parseMpegFrameHeader(bytes, offset) {
  if (offset + 4 > bytes.length) return null;
  const header = ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
  if ((header >>> 21) !== 0x7ff) return null;
  const version = (header >>> 19) & 0b11;
  const layer = (header >>> 17) & 0b11;
  const bitrateIndex = (header >>> 12) & 0b1111;
  const sampleIndex = (header >>> 10) & 0b11;
  if (version === 0b01 || layer === 0 || bitrateIndex === 0 || bitrateIndex === 0b1111 || sampleIndex === 0b11) return null;
  const mpeg1Bitrates = {
    1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0],
    2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 0],
    3: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 0]
  };
  const mpeg2Bitrates = {
    1: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
    2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
    3: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256, 0]
  };
  const bitrate = (version === 0b11 ? mpeg1Bitrates : mpeg2Bitrates)[layer][bitrateIndex] * 1000;
  const sampleRate = [44100, 48000, 32000][sampleIndex] / (version === 0b11 ? 1 : version === 0b10 ? 2 : 4);
  const padding = (header >>> 9) & 1;
  const frameLength = layer === 3
    ? Math.floor((12 * bitrate / sampleRate + padding) * 4)
    : Math.floor((version === 0b11 || layer !== 1 ? 144 : 72) * bitrate / sampleRate + padding);
  return frameLength > 4 ? { version, layer, sampleRate, frameLength } : null;
}

async function validateMp3File(file) {
  const tagHeader = new Uint8Array(await file.slice(0, 10).arrayBuffer());
  let scanStart = 0;
  if (tagHeader[0] === 0x49 && tagHeader[1] === 0x44 && tagHeader[2] === 0x33 && tagHeader.length >= 10) {
    const tagSize = ((tagHeader[6] & 0x7f) << 21) | ((tagHeader[7] & 0x7f) << 14) | ((tagHeader[8] & 0x7f) << 7) | (tagHeader[9] & 0x7f);
    scanStart = 10 + tagSize + ((tagHeader[5] & 0x10) ? 10 : 0);
  }
  const payload = new Uint8Array(await file.slice(scanStart, Math.min(file.size, scanStart + 128 * 1024)).arrayBuffer());
  let validFramePair = false;
  for (let offset = 0; offset + 4 < payload.length; offset += 1) {
    const frame = parseMpegFrameHeader(payload, offset);
    if (!frame || offset + frame.frameLength + 4 > payload.length) continue;
    const nextFrame = parseMpegFrameHeader(payload, offset + frame.frameLength);
    if (nextFrame?.version === frame.version && nextFrame.layer === frame.layer && nextFrame.sampleRate === frame.sampleRate) {
      validFramePair = true;
      break;
    }
  }
  if (!validFramePair || !elements.audio.canPlayType("audio/mpeg")) {
    throw new Error("MP3 格式無效、找不到可辨識的音訊串流，或此瀏覽器不支援播放。");
  }
}

function containsAscii(bytes, text) {
  const expected = Array.from(text, (character) => character.charCodeAt(0));
  for (let offset = 0; offset <= bytes.length - expected.length; offset += 1) {
    let match = true;
    for (let index = 0; index < expected.length; index += 1) {
      if (bytes[offset + index] !== expected[index]) { match = false; break; }
    }
    if (match) return true;
  }
  return false;
}

async function validateM4aFile(file) {
  let offset = 0;
  let foundFileType = false;
  let foundAudioData = false;
  let movieHeader = null;
  while (offset + 8 <= file.size) {
    const header = new DataView(await file.slice(offset, Math.min(file.size, offset + 16)).arrayBuffer());
    let boxSize = header.getUint32(0);
    const boxType = String.fromCharCode(header.getUint8(4), header.getUint8(5), header.getUint8(6), header.getUint8(7));
    let headerSize = 8;
    if (boxSize === 1) {
      if (header.byteLength < 16) break;
      const largeSize = header.getBigUint64(8);
      if (largeSize > BigInt(Number.MAX_SAFE_INTEGER)) break;
      boxSize = Number(largeSize);
      headerSize = 16;
    } else if (boxSize === 0) {
      boxSize = file.size - offset;
    }
    if (boxSize < headerSize || offset + boxSize > file.size) break;
    if (boxType === "ftyp") foundFileType = boxSize >= headerSize + 4;
    if (boxType === "mdat") foundAudioData = boxSize > headerSize;
    if (boxType === "moov") {
      if (boxSize > 32 * 1024 * 1024) break;
      movieHeader = new Uint8Array(await file.slice(offset + headerSize, offset + boxSize).arrayBuffer());
    }
    offset += boxSize;
  }
  const hasAudioTrack = movieHeader && containsAscii(movieHeader, "soun");
  const hasSupportedCodec = movieHeader && (containsAscii(movieHeader, "mp4a") || containsAscii(movieHeader, "alac"));
  if (!foundFileType || !foundAudioData || !hasAudioTrack || !hasSupportedCodec || !elements.audio.canPlayType("audio/mp4")) {
    throw new Error("M4A 格式無效、找不到可辨識的音訊串流，或此瀏覽器不支援播放。");
  }
}

async function validateAudioFile(file, extension) {
  if (extension === "mp3") await validateMp3File(file);
  else await validateM4aFile(file);
}

async function importOneFile(file) {
  if (!["mp3", "m4a"].includes(extensionFor(file.name))) throw new Error("不支援的檔案格式，請選擇 MP3 或 M4A。");
  if (!file.size) throw new Error("檔案是空的，無法匯入。");
  const song = {
    id: makeId(),
    source: "local",
    title: file.name.replace(/\.(mp3|m4a)$/i, "").trim() || "未命名歌曲",
    originalFileName: file.name,
    importedAt: new Date().toISOString(),
    audioBlob: file,
    customCoverBlob: null
  };
  await validateAudioFile(file, extensionFor(file.name));
  await writeRecord(song);
  localSongs.push(song);
  songs.push(song);
  if (shuffleEnabled) insertAtRandomPosition(shuffleUpcoming, song.id);
  renderLibrary();
  return song;
}

async function importSelectedFiles(fileList) {
  if (importing || !database) return;
  const files = Array.from(fileList || []);
  if (!files.length) return;
  importing = true;
  elements.importButton.disabled = true;
  elements.importButton.querySelector("span").textContent = "匯入中…";
  let saved = 0;
  const errors = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    setStatus(`正在保存 ${file.name}（${index + 1}/${files.length}）…`, "working");
    try { await importOneFile(file); saved += 1; }
    catch (error) { errors.push(`${file.name}：${error?.name === "QuotaExceededError" ? storageErrorMessage(error) : (error.message || storageErrorMessage(error))}`); }
  }
  importing = false;
  elements.importButton.disabled = false;
  elements.importButton.querySelector("span").textContent = "匯入本機音訊";
  elements.audioFiles.value = "";
  const summary = errors.length ? ` ${errors.slice(0, 2).join("；")}${errors.length > 2 ? `；另有 ${errors.length - 2} 個檔案失敗。` : ""}` : "";
  setStatus(`${saved ? `已保存 ${saved} 首本機歌曲。` : "沒有歌曲匯入。"}${summary}`, errors.length ? "error" : "success");
}

function updateSearchControls() { elements.clearSearchButton.hidden = elements.search.value.length === 0; }

function updateCoverPreviewClose() {
  if (!elements.coverPreviewDialog.open) cleanCoverPreview();
}

function updateOfflineUI() {
  if (!navigator.onLine) elements.offlineSupportNote.textContent = "目前離線：已下載歌曲可播放；尚未下載的線上歌曲會略過。離線啟動需先由 Service Worker 快取介面。";
  else elements.offlineSupportNote.textContent = "離線播放只適用於已下載並保存到此裝置的歌曲。尚未下載的線上音訊不會加入 Service Worker 快取。";
  renderLibrary();
}

async function initializeServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    elements.offlineSupportNote.textContent += " 此瀏覽器不支援 Service Worker。";
    return;
  }
  try {
    const script = new URL("./sw.js", document.baseURI);
    const scope = new URL("./", document.baseURI).pathname;
    serviceWorkerRegistration = await navigator.serviceWorker.register(script.href, { scope });
    const showWaiting = () => {
      if (!serviceWorkerRegistration?.waiting) return;
      elements.applyUpdateButton.hidden = false;
      elements.updateState.textContent = "播放器有可套用的更新。";
    };
    showWaiting();
    serviceWorkerRegistration.addEventListener("updatefound", () => {
      const worker = serviceWorkerRegistration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) showWaiting();
      });
    });
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      elements.updateState.textContent = "播放器更新已啟用；目前頁面不會強制重新載入，重新開啟時使用新版本。";
      elements.applyUpdateButton.hidden = true;
    });
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "UPDATE_READY") showWaiting();
    });
  } catch (error) {
    elements.updateState.textContent = "Service Worker 未啟用；在線播放仍可使用，離線重新開啟不保證可用。";
    console.warn("Service Worker registration failed:", error);
  }
}

function applyWaitingUpdate() {
  const waiting = serviceWorkerRegistration?.waiting;
  if (!waiting) return;
  waiting.postMessage({ type: "SKIP_WAITING" });
  elements.applyUpdateButton.disabled = true;
  elements.updateState.textContent = "正在套用更新；目前播放不會中斷或強制重新載入。";
}

async function initialize() {
  updateModeControls();
  updatePlaybackUI();
  renderLibrary();
  initializeServiceWorker();

  try {
    await openDatabase();
    const records = await readAllRecords();
    localSongs = records.map(normalizeStoredRecord).filter((song) => song && isLocalSong(song)).sort((a, b) => {
      const aTime = Date.parse(a.importedAt || "");
      const bTime = Date.parse(b.importedAt || "");
      if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) return aTime - bTime;
      return String(a.id).localeCompare(String(b.id));
    });
    remoteRecords = new Map(records.map(normalizeStoredRecord).filter((song) => song && isOnlineSong(song)).map((song) => [song.remoteId, song]));
    const cache = records.find((record) => record?.id === CATALOG_CACHE_ID && record.recordType === "catalog-cache");
    composeSongs();
    renderLibrary();
    if (cache?.entries) {
      try {
        const entries = validateCatalog({ songs: cache.entries }, catalogManifestUrl());
        await applyCatalog(entries, { persist: false });
        setStatus(`已載入上次保存的歌單（${entries.length} 首），正在檢查更新…`, "info");
      } catch (error) {
        setStatus(`上次保存的歌單格式無效：${error.message}`, "error");
      }
    } else {
      setStatus(localSongs.length ? `已載入 ${localSongs.length} 首本機歌曲，正在讀取線上歌單…` : "正在讀取線上歌單…", "info");
    }
  } catch (error) {
    database = null;
    setStatus(`無法讀取此裝置的音樂庫：${error.message || storageErrorMessage(error)} 線上播放仍可嘗試；下載與本機保存暫不可用。`, "error");
  }
  await refreshCatalog({ quiet: true });
}

function handleAudioError() {
  if (!currentSongId || !elements.audio.error) return;
  const song = currentSong();
  const errorText = !navigator.onLine && isOnlineSong(song) && !isDownloaded(song)
    ? offlineReason(song)
    : "音訊載入失敗。請檢查音訊網址、伺服器回應、格式或網路連線。";
  setStatus(errorText, "error");
  updatePlaybackUI();
  handleAutomaticLoadFailure();
}

function updateAudioPlayState() {
  updatePlaybackUI();
}

function onAudioPlaying() {
  autoFailedIds.clear();
  currentPlaybackWasAutomatic = false;
  updatePlaybackUI();
  setPlaybackStatus("正在播放");
}

function setPlaybackStatus(message) { elements.playbackStatus.textContent = message; }

function setupEventListeners() {
  elements.quickMenuButton.addEventListener("click", () => openDialog(elements.quickActionsDialog));
  elements.closeQuickActionsButton.addEventListener("click", () => closeDialog(elements.quickActionsDialog));
  elements.importButton.addEventListener("click", () => { closeDialog(elements.quickActionsDialog); elements.audioFiles.click(); });
  elements.audioFiles.addEventListener("change", (event) => importSelectedFiles(event.target.files));
  elements.downloadAllButton.addEventListener("click", () => { closeDialog(elements.quickActionsDialog); downloadAllSongs(); });
  elements.refreshPlaylistButton.addEventListener("click", () => { closeDialog(elements.quickActionsDialog); refreshCatalog(); });
  elements.emptyRefreshButton.addEventListener("click", refreshCatalog);
  elements.search.addEventListener("input", () => { updateSearchControls(); renderLibrary(); });
  elements.searchForm.addEventListener("submit", (event) => event.preventDefault());
  elements.clearSearchButton.addEventListener("click", () => { elements.search.value = ""; updateSearchControls(); renderLibrary(); elements.search.focus(); });
  elements.resetSearchButton.addEventListener("click", () => { elements.search.value = ""; updateSearchControls(); renderLibrary(); elements.search.focus(); });
  elements.miniTrack.addEventListener("click", () => openDialog(elements.playerDialog));
  elements.miniPlayButton.addEventListener("click", togglePlayback);
  elements.miniNextButton.addEventListener("click", playNext);
  elements.closePlayerButton.addEventListener("click", () => closeDialog(elements.playerDialog));
  elements.playButton.addEventListener("click", togglePlayback);
  elements.previousButton.addEventListener("click", playPrevious);
  elements.nextButton.addEventListener("click", playNext);
  elements.shuffleButton.addEventListener("click", () => {
    shuffleEnabled = !shuffleEnabled;
    persistShuffleSetting();
    shuffleHistory = [];
    shuffleUpcoming = shuffleEnabled ? shuffled(songIds().filter((id) => id !== currentSongId)) : [];
    updatePlaybackUI();
    setPlaybackStatus(shuffleEnabled ? "隨機播放已開啟" : "隨機播放已關閉");
  });
  elements.repeatButton.addEventListener("click", () => {
    loopMode = LOOP_MODES[(LOOP_MODES.indexOf(loopMode) + 1) % LOOP_MODES.length];
    persistLoopMode();
    updateModeControls();
    setPlaybackStatus(`循環模式：${loopModeLabel()}`);
  });
  elements.seekBar.addEventListener("input", () => {
    const time = Number(elements.seekBar.value);
    elements.elapsedTime.textContent = formatTime(time);
    if (Number.isFinite(elements.audio.duration)) elements.audio.currentTime = time;
  });
  elements.infoButton.addEventListener("click", () => openDialog(elements.infoDialog));
  elements.closeInfoButton.addEventListener("click", () => closeDialog(elements.infoDialog));
  elements.infoDoneButton.addEventListener("click", () => closeDialog(elements.infoDialog));
  elements.applyUpdateButton.addEventListener("click", applyWaitingUpdate);
  elements.closeTrackMenuButton.addEventListener("click", () => closeDialog(elements.trackMenuDialog));
  elements.coverFileInput.addEventListener("change", (event) => prepareCoverPreview(event.target.files?.[0]));
  elements.confirmCoverButton.addEventListener("click", confirmCoverChange);
  elements.cancelCoverButton.addEventListener("click", () => closeDialog(elements.coverPreviewDialog));
  elements.closeCoverPreviewButton.addEventListener("click", () => closeDialog(elements.coverPreviewDialog));
  elements.coverPreviewDialog.addEventListener("close", updateCoverPreviewClose);
  elements.audio.addEventListener("timeupdate", updateTimeline);
  elements.audio.addEventListener("durationchange", updateTimeline);
  elements.audio.addEventListener("loadedmetadata", updateTimeline);
  elements.audio.addEventListener("play", updateAudioPlayState);
  elements.audio.addEventListener("playing", onAudioPlaying);
  elements.audio.addEventListener("pause", () => {
    updatePlaybackUI();
    if (!elements.audio.ended && currentSongId) setPlaybackStatus("已暫停");
  });
  elements.audio.addEventListener("ended", handleNaturalEnd);
  elements.audio.addEventListener("error", handleAudioError);
  window.addEventListener("online", () => { updateOfflineUI(); refreshCatalog({ quiet: true }); });
  window.addEventListener("offline", updateOfflineUI);
  window.addEventListener("beforeunload", () => {
    releaseAudioUrl();
    for (const item of coverObjectUrls.values()) URL.revokeObjectURL(item.url);
    if (previewCoverUrl) URL.revokeObjectURL(previewCoverUrl);
    database?.close();
  });
}

setupEventListeners();
updateOfflineUI();
initialize();
