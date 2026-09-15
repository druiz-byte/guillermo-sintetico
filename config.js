// Configuración pública del sitio (NO pongas claves aquí: esto se publica en GitHub Pages).
window.GS_CONFIG = {
  // URL del Cloudflare Worker desplegado (carpeta /worker). Vacío = modo demo
  // (guion local + voz del navegador, sin IA ni ElevenLabs).
  API_BASE: "",
  // Avatar: "anam" (vídeo en tiempo real de Anam) o "svg" (avatar ilustrado). Con API_BASE vacío siempre es "svg".
  AVATAR_PROVIDER: "anam",
  // Voz: "elevenlabs" (Anam sincroniza los labios con el audio de ElevenLabs) o "anam" (voz propia de Anam).
  VOICE_PROVIDER: "elevenlabs",
  DECK_URL: "slides/slides.json",
  DEFAULT_LANG: "es",
  PRESENTER_NAME: "Guillermo",
  AUTO_ADVANCE: true,
  // Variantes regionales (voz del navegador y estilo del guion). Cambia pt-PT por pt-BR si lo prefieres.
  LOCALES: { es: "es-ES", en: "en-GB", pt: "pt-PT" }
};
