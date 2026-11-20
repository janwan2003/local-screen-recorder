// Recordings kept in OPFS (the browser's private disk area for this site or extension),
// plus exporting them to a real file on the user's disk.
import { Input, Output, Conversion, BlobSource, ALL_FORMATS, Mp4OutputFormat, WebMOutputFormat, BufferTarget, StreamTarget } from './vendor/mediabunny.mjs';

async function dir() {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle('recordings', { create: true });
}

export async function list() {
  const d = await dir();
  const out = [];
  for await (const [name, h] of d.entries()) {
    if (h.kind !== 'file') continue;
    try {
      const f = await h.getFile();
      out.push({ name, size: f.size, modified: f.lastModified });
    } catch { /* still being written by the worker */ }
  }
  return out.sort((a, b) => b.modified - a.modified);
}

export async function getFile(name) { return (await (await dir()).getFileHandle(name)).getFile(); }
export async function remove(name) { return (await dir()).removeEntry(name); }

export async function rename(oldName, newName) {
  const d = await dir();
  const h = await d.getFileHandle(oldName);
  if (typeof h.move === 'function') { await h.move(newName); return; }
  throw new Error('Renaming is not supported in this browser.');
}

export async function usage() {
  const e = await navigator.storage.estimate();
  return { used: e.usage || 0, quota: e.quota || 0 };
}

/** Reads duration and tracks of a recording. */
export async function probe(file) {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const [duration, v, a] = await Promise.all([input.computeDuration(), input.getPrimaryVideoTrack(), input.getPrimaryAudioTrack()]);
    return {
      duration,
      video: v ? { codec: v.codec, width: v.displayWidth, height: v.displayHeight } : null,
      audio: a ? { codec: a.codec, channels: a.numberOfChannels, sampleRate: a.sampleRate } : null,
    };
  } finally { input.dispose?.(); }
}

/**
 * Exports a recording as a standard (non-fragmented) MP4 or a WebM, optionally trimmed.
 * Trims copy the encoded video without re-encoding (cut points snap to the nearest key frame,
 * at most 2 s away), so export of a long recording takes seconds.
 * `sink` is a FileSystemWritableFileStream (from the save picker) or null to get a Blob back.
 */
export async function exportRecording(file, { format = 'mp4', trim = null, onProgress, sink = null } = {}) {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const fmt = format === 'webm' ? new WebMOutputFormat() : new Mp4OutputFormat({ fastStart: sink ? 'reserve' : 'in-memory' });
  let target, writer;
  if (sink) {
    target = new StreamTarget(new WritableStream({
      async write(chunk) { await sink.write({ type: 'write', position: chunk.position, data: chunk.data }); },
      async close() { await sink.close(); },
      async abort() { await sink.abort?.(); },
    }), { chunked: true });
  } else target = new BufferTarget();
  const output = new Output({ format: fmt, target });
  const opts = { input, output, showWarnings: false };
  if (trim) opts.trim = { start: trim.start, end: trim.end };
  if (format === 'webm') {
    opts.video = { codec: 'vp9' };
    opts.audio = { codec: 'opus' };
  }
  const conv = await Conversion.init(opts);
  if (!conv.isValid) throw new Error('This recording cannot be converted: ' + conv.discardedTracks.map((t) => t.reason).join(', '));
  if (onProgress) conv.onProgress = onProgress;
  await conv.execute();
  input.dispose?.();
  return sink ? null : new Blob([target.buffer], { type: format === 'webm' ? 'video/webm' : 'video/mp4' });
}
