/// <reference lib="webworker" />
import { KokoroTTS } from "kokoro-js";

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
let tts: KokoroTTS | null = null;

self.onmessage = async (e: MessageEvent) => {
  const { type, ...data } = e.data;

  if (type === "init") {
    const device: "wasm" | "webgpu" = data.device ?? "wasm";
    const dtype = device === "webgpu" ? "fp32" : "q8";
    try {
      tts = await KokoroTTS.from_pretrained(MODEL_ID, {
        dtype,
        device,
        progress_callback: (p: { status: string; loaded?: number; total?: number }) => {
          if ((p.status === "progress" || p.status === "download") && p.total) {
            self.postMessage({ type: "progress", loaded: p.loaded ?? 0, total: p.total });
          }
        },
      });
      self.postMessage({ type: "ready", voices: tts.list_voices() });
    } catch (err) {
      self.postMessage({ type: "error", message: (err as Error).message });
    }
  } else if (type === "generate") {
    if (!tts) {
      self.postMessage({ type: "error", id: data.id, message: "TTS not initialized" });
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await tts.generate(data.text as string, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        voice: data.voice as any,
        speed: data.speed as number,
      });
      const audio = result.audio;
      const sampleRate = result.sampling_rate;
      self.postMessage(
        { type: "audio", id: data.id, audio, sampleRate },
        { transfer: [audio.buffer] },
      );
    } catch (err) {
      self.postMessage({ type: "error", id: data.id, message: (err as Error).message });
    }
  }
};
