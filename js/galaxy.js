/* ==========================================================
   Angel's Fisioterapia & Estética — "pó de luz dourado"

   Baseado no componente <Galaxy /> do React Bits (https://reactbits.dev), reescrito em
   JavaScript puro (sem React). Depende só da biblioteca ogl (MIT), local em vendor/ogl.mjs.
   Alterações em relação ao original: estrelas em duas cores da marca (dourado e rosa) em vez de
   arco-íris, pausa fora da tela / aba oculta, DPR limitado, ResizeObserver, fallbacks e
   prefers-reduced-motion.
   ATENÇÃO: confira a licença do React Bits no repositório deles antes de publicar o site de um cliente.
   ========================================================== */
import { Renderer, Program, Mesh, Triangle } from './vendor/ogl.mjs';

/* ---------- Configuração (edite aqui) ---------- */
const GALAXY_CONFIG = {
  density: 0.8,            // poucas estrelas: é pó de luz, não céu estrelado
  glowIntensity: 0.18,
  twinkleIntensity: 0.6,   // cintilar visível, mas suave
  starSpeed: 0.3,
  speed: 0.6,
  rotationSpeed: 0.02,     // rotação quase imperceptível
  mouseInteraction: true,
  mouseRepulsion: true,
  repulsionStrength: 1.2,
  transparent: true,
  proporcaoCorB: 0.25,     // fatia de estrelas rosa (o resto é dourado)
  opacidade: 0.6,          // sobe se as estrelas sumirem no fundo claro, desce se ficarem fortes
  densidadeCelular: 0.5,   // density no celular
  larguraCelular: 640,
  dprMaxCelular: 1.5,
  dprMaxDesktop: 2,
  // cores lidas das variáveis CSS (troque a paleta em style.css); estes são só valores de reserva
  corA: '#E7C06A',
  corB: '#E2728F',
};

/* ---------- Shaders ---------- */
const vertexShader = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0, 1);
}
`;

const fragmentShader = `
precision highp float;

uniform float uTime;
uniform vec3 uResolution;
uniform vec2 uFocal;
uniform vec2 uRotation;
uniform float uStarSpeed;
uniform float uDensity;
uniform float uSpeed;
uniform vec2 uMouse;
uniform float uGlowIntensity;
uniform bool uMouseRepulsion;
uniform float uTwinkleIntensity;
uniform float uRotationSpeed;
uniform float uRepulsionStrength;
uniform float uMouseActiveFactor;
uniform vec3 uCorA;
uniform vec3 uCorB;
uniform float uProporcaoB;
uniform float uOpacidade;

varying vec2 vUv;

#define NUM_LAYER 4.0
#define MAT45 mat2(0.7071, -0.7071, 0.7071, 0.7071)
#define PERIOD 3.0

float Hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float tri(float x) {
  return abs(fract(x) * 2.0 - 1.0);
}

float tris(float x) {
  float t = fract(x);
  return 1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0));
}

float trisn(float x) {
  float t = fract(x);
  return 2.0 * (1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0))) - 1.0;
}

float Star(vec2 uv, float flare) {
  float d = length(uv);
  float m = (0.05 * uGlowIntensity) / d;
  float rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));
  m += rays * flare * uGlowIntensity;
  uv *= MAT45;
  rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));
  m += rays * 0.3 * flare * uGlowIntensity;
  m *= smoothstep(1.0, 0.2, d);
  return m;
}

vec3 StarLayer(vec2 uv) {
  vec3 col = vec3(0.0);

  vec2 gv = fract(uv) - 0.5;
  vec2 id = floor(uv);

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y));
      vec2 si = id + vec2(float(x), float(y));
      float seed = Hash21(si);
      float size = fract(seed * 345.32);
      float glossLocal = tri(uStarSpeed / (PERIOD * seed + 1.0));
      float flareSize = smoothstep(0.9, 1.0, size) * glossLocal;

      // cor da marca: dourado na maioria, rosa vivo em uma minoria
      float rosa = step(1.0 - uProporcaoB, fract(seed * 91.7 + 0.31));
      vec3 base = mix(uCorA, uCorB, rosa);

      vec2 pad = vec2(tris(seed * 34.0 + uTime * uSpeed / 10.0), tris(seed * 38.0 + uTime * uSpeed / 30.0)) - 0.5;

      float star = Star(gv - offset - pad, flareSize);

      float twinkle = trisn(uTime * uSpeed + seed * 6.2831) * 0.5 + 1.0;
      twinkle = mix(1.0, twinkle, uTwinkleIntensity);
      star *= twinkle;

      col += star * size * base;
    }
  }

  return col;
}

void main() {
  vec2 focalPx = uFocal * uResolution.xy;
  vec2 uv = (vUv * uResolution.xy - focalPx) / uResolution.y;

  vec2 mouseNorm = uMouse - vec2(0.5);

  if (uMouseRepulsion) {
    vec2 mousePosUV = (uMouse * uResolution.xy - focalPx) / uResolution.y;
    float mouseDist = length(uv - mousePosUV);
    vec2 repulsion = normalize(uv - mousePosUV) * (uRepulsionStrength / (mouseDist + 0.1));
    uv += repulsion * 0.05 * uMouseActiveFactor;
  } else {
    uv += mouseNorm * 0.1 * uMouseActiveFactor;
  }

  float autoRotAngle = uTime * uRotationSpeed;
  mat2 autoRot = mat2(cos(autoRotAngle), -sin(autoRotAngle), sin(autoRotAngle), cos(autoRotAngle));
  uv = autoRot * uv;
  uv = mat2(uRotation.x, -uRotation.y, uRotation.y, uRotation.x) * uv;

  vec3 col = vec3(0.0);
  for (float i = 0.0; i < 1.0; i += 1.0 / NUM_LAYER) {
    float depth = fract(i + uStarSpeed * uSpeed);
    float scale = mix(20.0 * uDensity, 0.5 * uDensity, depth);
    float fade = depth * smoothstep(1.0, 0.9, depth);
    col += StarLayer(uv * scale + i * 453.32) * fade;
  }

  // Fundo transparente. A cor sai "pura" (sem escurecer) e a intensidade vira opacidade,
  // para as estrelas aparecerem como luz dourada sobre o fundo claro do site.
  float energy = max(max(col.r, col.g), col.b);
  float alpha = smoothstep(0.0, 0.3, length(col)) * uOpacidade;
  vec3 rgb = col / max(energy, 0.0001);
  gl_FragColor = vec4(min(rgb, vec3(1.0)), clamp(alpha, 0.0, 1.0));
}
`;

/* ---------- Utilitários ---------- */
function hexParaRgb(hex) {
  const h = String(hex).trim().replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  if (isNaN(n)) return null;
  return new Float32Array([((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]);
}
function corDoCss(nome, reserva) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(nome);
  return hexParaRgb(v) || hexParaRgb(reserva);
}

/* ---------- Galaxy em JavaScript puro ----------
   criarGalaxy(container, opcoes) -> { pausar, retomar, destruir, atualizar(opcoes) }
   opcoes extras: areaMouse (elemento que recebe o mouse, padrão = pai do container),
                  observar (elemento que decide se está na tela, padrão = pai do container),
                  disableAnimation, onPronto, onFalha */
export function criarGalaxy(container, opcoes) {
  const o = Object.assign({}, GALAXY_CONFIG, opcoes || {});
  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)');
  const ehCelular = () => window.innerWidth <= o.larguraCelular;
  const areaMouse = o.areaMouse || container.parentElement || container;
  const observar = o.observar || container.parentElement || container;

  let renderer, gl, program, mesh;
  try {
    renderer = new Renderer({
      alpha: o.transparent,
      premultipliedAlpha: false,
      antialias: false,
      dpr: Math.min(window.devicePixelRatio || 1, ehCelular() ? o.dprMaxCelular : o.dprMaxDesktop),
    });
    gl = renderer.gl;
    if (!gl || !gl.canvas) throw new Error('sem WebGL');
  } catch (erro) {
    if (o.onFalha) o.onFalha(erro);
    return { pausar() {}, retomar() {}, destruir() {}, atualizar() {} };
  }

  if (o.transparent) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
  } else {
    gl.clearColor(0, 0, 0, 1);
  }
  gl.canvas.setAttribute('aria-hidden', 'true');

  const mouseAlvo = { x: 0.5, y: 0.5 };
  const mouseSuave = { x: 0.5, y: 0.5 };
  let ativoAlvo = 0, ativoSuave = 0;
  let tempo = 0, ultimo = 0, raf = 0;
  let naTela = true, abaVisivel = !document.hidden, pausadoPorFora = false, destruido = false;

  function densidade() { return ehCelular() ? o.densidadeCelular : o.density; }
  function aplicarTamanho() {
    renderer.dpr = Math.min(window.devicePixelRatio || 1, ehCelular() ? o.dprMaxCelular : o.dprMaxDesktop);
    const w = container.offsetWidth, h = container.offsetHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    if (program) {
      const r = program.uniforms.uResolution.value;
      r[0] = gl.canvas.width; r[1] = gl.canvas.height; r[2] = gl.canvas.width / gl.canvas.height;
    }
    program.uniforms.uDensity.value = densidade();
    if (!animando()) desenharQuadro();
  }
  function animando() { return !o.disableAnimation && !reduzido.matches; }

  const geometry = new Triangle(gl);
  program = new Program(gl, {
    vertex: vertexShader,
    fragment: fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: new Float32Array([gl.canvas.width, gl.canvas.height, 1]) },
      uFocal: { value: new Float32Array([0.5, 0.5]) },
      uRotation: { value: new Float32Array([1.0, 0.0]) },
      uStarSpeed: { value: o.starSpeed },
      uDensity: { value: densidade() },
      uSpeed: { value: o.speed },
      uMouse: { value: new Float32Array([0.5, 0.5]) },
      uGlowIntensity: { value: o.glowIntensity },
      uMouseRepulsion: { value: o.mouseRepulsion },
      uTwinkleIntensity: { value: o.twinkleIntensity },
      uRotationSpeed: { value: o.rotationSpeed },
      uRepulsionStrength: { value: o.repulsionStrength },
      uMouseActiveFactor: { value: 0 },
      uCorA: { value: corDoCss('--galaxy-a', o.corA) },
      uCorB: { value: corDoCss('--galaxy-b', o.corB) },
      uProporcaoB: { value: o.proporcaoCorB },
      uOpacidade: { value: o.opacidade },
    },
  });
  mesh = new Mesh(gl, { geometry, program });
  container.appendChild(gl.canvas);
  aplicarTamanho();

  function desenharQuadro() {
    const u = program.uniforms;
    u.uTime.value = tempo;
    u.uStarSpeed.value = (tempo * o.starSpeed) / 10.0;
    u.uMouse.value[0] = mouseSuave.x;
    u.uMouse.value[1] = mouseSuave.y;
    u.uMouseActiveFactor.value = ativoSuave;
    renderer.render({ scene: mesh });
  }
  function quadro(t) {
    raf = requestAnimationFrame(quadro);
    const dt = Math.min((t - ultimo) / 1000 || 0, 0.05);   // sem saltos depois de uma pausa
    ultimo = t;
    tempo += dt;
    const k = 0.05;
    mouseSuave.x += (mouseAlvo.x - mouseSuave.x) * k;
    mouseSuave.y += (mouseAlvo.y - mouseSuave.y) * k;
    ativoSuave += (ativoAlvo - ativoSuave) * k;
    desenharQuadro();
  }

  function deveRodar() { return !destruido && !pausadoPorFora && naTela && abaVisivel && animando(); }
  function sincronizar() {
    cancelAnimationFrame(raf);
    raf = 0;
    if (deveRodar()) {
      ultimo = performance.now();
      raf = requestAnimationFrame(quadro);
    } else if (!destruido) {
      desenharQuadro();   // um quadro parado (reduced motion, ou ao pausar)
    }
  }

  function aoMover(e) {
    if (reduzido.matches || !o.mouseInteraction) return;
    const r = container.getBoundingClientRect();
    mouseAlvo.x = (e.clientX - r.left) / r.width;
    mouseAlvo.y = 1 - (e.clientY - r.top) / r.height;
    ativoAlvo = 1;
  }
  function aoSair() { ativoAlvo = 0; }
  if (o.mouseInteraction) {
    areaMouse.addEventListener('mousemove', aoMover);
    areaMouse.addEventListener('mouseleave', aoSair);
  }

  const ro = 'ResizeObserver' in window ? new ResizeObserver(aplicarTamanho) : null;
  if (ro) ro.observe(container); else window.addEventListener('resize', aplicarTamanho);

  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((es) => { naTela = es[0].isIntersecting; sincronizar(); }, { rootMargin: '80px' })
    : null;
  if (io) io.observe(observar);

  const aoVisibilidade = () => { abaVisivel = !document.hidden; sincronizar(); };
  document.addEventListener('visibilitychange', aoVisibilidade);
  const aoReduzido = () => { if (reduzido.matches) ativoAlvo = ativoSuave = 0; sincronizar(); };
  if (reduzido.addEventListener) reduzido.addEventListener('change', aoReduzido);

  const aoPerderContexto = (e) => { e.preventDefault(); destruir(); if (o.onFalha) o.onFalha(new Error('contexto perdido')); };
  gl.canvas.addEventListener('webglcontextlost', aoPerderContexto);

  function destruir() {
    if (destruido) return;
    destruido = true;
    cancelAnimationFrame(raf);
    areaMouse.removeEventListener('mousemove', aoMover);
    areaMouse.removeEventListener('mouseleave', aoSair);
    if (ro) ro.disconnect(); else window.removeEventListener('resize', aplicarTamanho);
    if (io) io.disconnect();
    document.removeEventListener('visibilitychange', aoVisibilidade);
    if (reduzido.removeEventListener) reduzido.removeEventListener('change', aoReduzido);
    gl.canvas.removeEventListener('webglcontextlost', aoPerderContexto);
    if (gl.canvas.parentNode) gl.canvas.parentNode.removeChild(gl.canvas);
    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
  }

  sincronizar();
  if (o.onPronto) requestAnimationFrame(() => o.onPronto());

  return {
    pausar() { pausadoPorFora = true; sincronizar(); },
    retomar() { pausadoPorFora = false; sincronizar(); },
    destruir,
    atualizar(novas) {
      Object.assign(o, novas || {});
      const u = program.uniforms;
      u.uStarSpeed.value = o.starSpeed;
      u.uSpeed.value = o.speed;
      u.uGlowIntensity.value = o.glowIntensity;
      u.uMouseRepulsion.value = o.mouseRepulsion;
      u.uTwinkleIntensity.value = o.twinkleIntensity;
      u.uRotationSpeed.value = o.rotationSpeed;
      u.uRepulsionStrength.value = o.repulsionStrength;
      u.uProporcaoB.value = o.proporcaoCorB;
      u.uOpacidade.value = o.opacidade;
      u.uCorA.value = corDoCss('--galaxy-a', o.corA);
      u.uCorB.value = corDoCss('--galaxy-b', o.corB);
      aplicarTamanho();
      sincronizar();
    },
  };
}

/* ---------- Ligação com a página: <div class="galaxy" data-galaxy> ----------
   Ajustes por seção: data-galaxy-density="0.5", data-galaxy-opacidade="0.8" */
function iniciar() {
  document.querySelectorAll('[data-galaxy]').forEach((el) => {
    const extra = {};
    if (el.dataset.galaxyDensity) extra.density = extra.densidadeCelular = parseFloat(el.dataset.galaxyDensity);
    if (el.dataset.galaxyOpacidade) extra.opacidade = parseFloat(el.dataset.galaxyOpacidade);
    if (el.dataset.galaxyMouse === 'off') extra.mouseInteraction = false;
    criarGalaxy(el, Object.assign(extra, {
      onPronto: () => el.classList.add('is-ready'),                 // entra com fade
      onFalha: () => { el.classList.remove('is-ready'); el.classList.add('galaxy-fallback'); },
    }));
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
else iniciar();
