// Configuración pública del sitio (NO pongas claves aquí: esto se publica en GitHub Pages).
window.GS_CONFIG = {
  // URL del servidor intermedio desplegado (Render). Vacío = modo demo
  // (guion local + voz del navegador, sin IA).
  API_BASE: "https://guillermo-sintetico-api.onrender.com",
  // Avatar: "anam" (vídeo en tiempo real de Anam) o "svg" (avatar ilustrado). Con API_BASE vacío siempre es "svg".
  AVATAR_PROVIDER: "anam",
  // Voz: "anam" (voz propia de Anam) o "elevenlabs" (Anam sincroniza los labios con el audio de ElevenLabs).
  VOICE_PROVIDER: "anam",
  DECK_URL: "slides/slides.json",
  DEFAULT_LANG: "es",
  PRESENTER_NAME: "Guillermo",
  AUTO_ADVANCE: true,
  // Variantes regionales (voz del navegador y estilo del guion). Cambia pt-PT por pt-BR si lo prefieres.
  LOCALES: { es: "es-ES", en: "en-GB", pt: "pt-PT" }
};
