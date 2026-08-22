export const AUDIO_FRAMES = [
  { id: "gold-phoenix", name: "流火凤仪", tone: "华丽", src: "/assets/audio-event/ornate-frame-portrait.webp" },
  { id: "cloud-jade", name: "云水青玉", tone: "淡雅", src: "/assets/audio-event/frame-cloud-jade.webp" },
  { id: "bamboo-crane", name: "竹鹤月华", tone: "淡雅", src: "/assets/audio-event/frame-bamboo-crane.webp" },
  { id: "starlight-glass", name: "星河琉璃", tone: "华丽", src: "/assets/audio-event/frame-starlight-glass.webp" },
  { id: "purple-gold", name: "紫霄鎏金", tone: "华丽", src: "/assets/audio-event/frame-purple-gold.webp" },
] as const;

export type AudioFrameId = (typeof AUDIO_FRAMES)[number]["id"];

export function getAudioFrame(id?: string) {
  return AUDIO_FRAMES.find((frame) => frame.id === id) ?? AUDIO_FRAMES[0];
}
