# Guillermo sintético

Web estática (GitHub Pages) en la que un avatar de vídeo en tiempo real ([Anam](https://anam.ai)) presenta una presentación: lee el contenido de cada diapositiva, aporta ideas propias generadas por IA en directo (Claude) y habla con voz ElevenLabs en **castellano, inglés o portugués**. El público puede además hacerle preguntas.

```
index.html · css/ · js/        → web pública (GitHub Pages)
config.js                      → URL del proxy, idioma por defecto, variantes regionales
slides/slides.json (+ img/)    → la presentación
tools/build_slides.py          → convierte tu PPTX/PDF en slides.json + imágenes
worker/                        → Cloudflare Worker que guarda las claves y llama a Claude y ElevenLabs
```

## Cómo funciona

1. Para cada diapositiva la web envía al Worker su título, viñetas, texto y notas del orador.
2. El Worker pide a Claude un guion hablado de 90–160 palabras en el idioma elegido: primero transmite el contenido y después añade una o dos aportaciones propias (implicación práctica, ejemplo empresarial, matiz o pregunta), con instrucciones de no inventar datos ni citas.
   Claude recibe también la **imagen de la diapositiva**, de modo que puede comentar gráficos y fotografías, no solo el texto.
3. El guion se convierte en audio con ElevenLabs (PCM 16 kHz) y se envía al avatar de Anam, que lo pronuncia con sincronía labial. Se muestran subtítulos.
4. Las animaciones por pasos del PowerPoint se agrupan en una sola diapositiva: el avatar la comenta una vez mientras los pasos avanzan.
5. Al terminar, avanza a la siguiente diapositiva (la siguiente ya se ha precargado).

Si Anam no está disponible, la web recurre automáticamente a un avatar ilustrado con la misma voz de ElevenLabs.

Sin `API_BASE` configurado, la web funciona en **modo demo** (lee el texto de la diapositiva con la voz del navegador, sin IA).

## Puesta en marcha

### 1. Cargar tu presentación
```bash
pip install python-pptx pillow   # además: LibreOffice y poppler-utils
python3 tools/build_slides.py mi_presentacion.pptx --title "Título de la charla"
```
La presentación actual (Módulo 1.1 · Contexto digital, 141 páginas → 79 diapositivas) se generó con:
```bash
python3 tools/build_slides.py modulo_1_1.pdf --title "Transformación Digital para la PYME · Módulo 1.1 · Contexto digital" \
  --groups "$(cat tools/grupos_modulo_1_1.txt)" --brief "1,39,51,69,76" \
  --footer "Transformación Digital para la PYME - Guillermo Dorronsoro"
```
Después se ajustaron a mano algunos títulos en `slides/slides.json` (sirven para el índice y como contexto para la IA).
Las **notas del orador** del PPTX se usan como guía de lo que Guillermo debe subrayar: es la mejor forma de orientar sus aportaciones.

### 2. Desplegar el proxy (Cloudflare Worker, plan gratuito)
```bash
cd worker
npm i -g wrangler && wrangler login
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put ELEVENLABS_API_KEY
wrangler secret put ANAM_API_KEY
# edita wrangler.toml: VOICE_ID (o VOICE_ID_ES / _EN / _PT), ANAM_AVATAR_ID y ALLOWED_ORIGINS
wrangler deploy
```
Copia la URL resultante (`https://guillermo-sintetico-api.<cuenta>.workers.dev`) en `API_BASE` de `config.js`.

### 3. Publicar en GitHub Pages
Settings → Pages → *Deploy from a branch* → `main` / `(root)`. La web quedará en `https://druiz-byte.github.io/guillermo-sintetico/`.

Parámetros de URL útiles: `?lang=pt`, `?slide=12`, `?deck=otra/slides.json`.

## Costes y control
- El guion y el audio de cada diapositiva+idioma se guardan en la caché del Worker (`CACHE_TTL`, 7 días por defecto), así que las siguientes visitas no vuelven a pagar. Pon `CACHE_TTL = "0"` para generar siempre un guion nuevo, o cambia `PROMPT_VERSION` para regenerar tras editar el prompt.
- **Anam** factura por minuto de vídeo: la sesión solo se abre al pulsar «Presentar», se cierra 90 s después de acabar o al ocultar la pestaña en pausa, y dura como máximo `ANAM_MAX_SECONDS`.
- Las preguntas del público no se cachean. Recomendado: una regla de *Rate limiting* en Cloudflare sobre `/api/*`.
- Modelos por defecto: `claude-sonnet-5` y `eleven_multilingual_v2` (configurables en `wrangler.toml`; `eleven_flash_v2_5` es más rápido y barato).

## Personalización
- **Voz**: puedes clonar tu voz en ElevenLabs y usar su `voice_id`; una misma voz multilingüe sirve para los tres idiomas.
- **Portugués**: `LOCALES.pt` en `config.js` admite `pt-PT` o `pt-BR`.
- **Avatar de Anam**: `ANAM_AVATAR_ID` en `wrangler.toml` (actual: `d7741c8e-2541-456b-a72f-c24882a5364a`). Para usar la voz propia de Anam en lugar de ElevenLabs: `VOICE_PROVIDER = "anam"` en `wrangler.toml` y en `config.js`, y define `ANAM_VOICE_ID_ES/_EN/_PT`.
- **Avatar de respaldo**: `js/avatar.js` contiene el SVG; puede sustituirse manteniendo los ids `#mouth`, `#lidL`, `#lidR` y `#head`.
- **Estilo del discurso**: `systemPrompt()` en `worker/src/index.js`.

## Nota ética y de derechos
El avatar es sintético y así se indica en la web; el guion le impide hacerse pasar por el autor de las diapositivas. Si el avatar o la voz reproducen a una persona real, hace falta su consentimiento expreso. Las diapositivas y las imágenes de terceros que contienen se publican en un repositorio público: comprueba que tienes permiso para difundirlas.
