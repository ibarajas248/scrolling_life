import './warmPool.js?v=20260917';
import { createPhoneStage, PHONE_WIDTH, PHONE_HEIGHT } from './phoneStage.js?v=20260917';
import {
  loadLocalManifest,
  rebuildPlaylist,
  createFeedScroller,
  watchLibrary,
} from './feed.js?v=20260917';
import { scoreEmotions } from './catalog.js?v=20260917';
import { reactToVideo } from './npcReaction.js?v=20260917';

const { stage: phoneStage } = createPhoneStage();

/** Última emoción — se aplica cuando Three.js esté listo. */
let pendingExpression = 'neutral';
let applyExpression = (cat) => {
  pendingExpression = cat || 'neutral';
};

function emotionFromVideo(video) {
  const text = [video?.texto, video?.title].filter(Boolean).join(' ');
  const result = reactToVideo(video, scoreEmotions(text));
  video.categoria = result.emotion;
  return result.emotion;
}

async function boot() {
  await loadLocalManifest();
  const playlist = rebuildPlaylist();

  const { createFeedOverlay } = await import('./screen.js?v=20260917-share');
  const feed = createFeedOverlay({ mount: phoneStage, playlist });

  let scroller = null;
  let unwatchLibrary = null;

  function shutdownMedia() {
    scroller?.stop();
    feed.stopPlayback();
  }

  function onPageHidden() {
    shutdownMedia();
  }

  function onPageVisible() {
    if (document.hidden) return;
    feed.resumePlayback();
  }

  window.addEventListener('pagehide', shutdownMedia);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) onPageHidden();
    else onPageVisible();
  });

  function startFeed() {
    if (scroller) return;

    function goNext() {
      scroller?.next();
    }

    scroller = createFeedScroller({
      onChange(video) {
        if (!video) return;
        // Reacción subjetiva ANTES de pintar UI (estado + historial)
        const emotion = emotionFromVideo(video);
        applyExpression(emotion);
        feed.showVideo(video, {
          onVisible() {
            /* expresión ya aplicada; estado ya actualizado */
          },
        });
      },
      onPreload(video) {
        feed.preload(video);
      },
      onEmpty() {
        console.warn('[feed] sin vídeos reproducibles — reintentando…');
      },
    });

    feed.onPlaybackFail(goNext);
    feed.onVideoEnded(goNext);
    feed.onClipReady((ms) => scroller?.armFromMedia(ms));
    scroller.start();

    // Detecta library/manifest nuevos cada 5 min (sin reiniciar el clip actual)
    unwatchLibrary = watchLibrary({
      onUpdate({ videos }) {
        scroller?.refreshPool();
        console.info(
          `[library] pool actualizado: ${videos.length} clips — loop sigue activo`,
        );
      },
    });
  }

  feed.whenUnlocked(startFeed);
  bootScene();
}

async function bootScene() {
  const [three, { createCharacter }, { setExpression }] = await Promise.all([
    import('../assets/three.module-BtCAaDxU.js'),
    import('./character.js?v=20260917'),
    import('./expressions.js?v=20260917'),
  ]);

  const {
    Scene,
    PerspectiveCamera,
    WebGLRenderer,
    Color,
    AmbientLight,
    Clock,
    SRGBColorSpace,
  } = three;

  const scene = new Scene();
  scene.background = new Color(0x000000);

  const phoneAspect = PHONE_WIDTH / PHONE_HEIGHT;
  const camera = new PerspectiveCamera(40, phoneAspect, 0.1, 50);
  camera.position.set(0, 0.05, 3.1);
  camera.lookAt(0, 0.05, 0);

  const renderer = new WebGLRenderer({
    antialias: false,
    powerPreference: 'high-performance',
    alpha: false,
  });
  renderer.setSize(PHONE_WIDTH, PHONE_HEIGHT);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.domElement.style.zIndex = '1';
  phoneStage.appendChild(renderer.domElement);

  scene.add(new AmbientLight(0xffffff, 0.9));

  const { group: npc, faceParts } = createCharacter();
  scene.add(npc);

  applyExpression = (cat) => {
    pendingExpression = cat || 'neutral';
    setExpression(faceParts, pendingExpression);
  };
  setExpression(faceParts, pendingExpression);

  const clock = new Clock();
  function animate() {
    requestAnimationFrame(animate);
    npc.position.y = Math.sin(clock.getElapsedTime() * 1.05) * 0.015;
    renderer.render(scene, camera);
  }
  animate();
}

boot();
