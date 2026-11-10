// MediaPipe Face Landmarker loading and result helpers.
// The model and WASM runtime are served locally from /public — no cloud
// inference, no network calls with camera data.

export const FACE_LANDMARKER_MODEL_PATH = '/models/face_landmarker.task';
export const MEDIAPIPE_WASM_PATH = '/mediapipe/wasm';

export const DEFAULT_FACE_LANDMARKER_OPTIONS = Object.freeze({
  runningMode: 'VIDEO',
  numFaces: 1,
  outputFacialTransformationMatrixes: true,
  outputFaceBlendshapes: true,
});

/**
 * Creates a VIDEO-mode Face Landmarker. The library is imported lazily so it
 * is only downloaded when the camera is actually started.
 *
 * @param {{ isCancelled?: () => boolean, options?: object }} [config]
 * @returns {Promise<object|null>} the landmarker, or null if cancelled meanwhile
 *   (a landmarker created after cancellation is closed before returning).
 */
export async function createVideoFaceLandmarker({ isCancelled = () => false, options = {} } = {}) {
  const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
  if (isCancelled()) return null;

  const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_PATH);
  if (isCancelled()) return null;

  const landmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL_PATH },
    ...DEFAULT_FACE_LANDMARKER_OPTIONS,
    ...options,
  });
  if (isCancelled()) {
    landmarker.close();
    return null;
  }
  return landmarker;
}

/**
 * Reads selected blendshape scores of the first face.
 * Returns null when the result has no blendshapes; missing or non-finite
 * scores are reported as null.
 *
 * @param {object} results Face Landmarker result
 * @param {readonly string[]} names blendshape category names
 * @returns {Record<string, number|null>|null}
 */
export function extractBlendshapeScores(results, names) {
  const categories = results?.faceBlendshapes?.[0]?.categories;
  if (!Array.isArray(categories) || categories.length === 0) return null;

  const scores = Object.fromEntries(names.map((name) => [name, null]));
  categories.forEach(({ categoryName, score }) => {
    if (Object.prototype.hasOwnProperty.call(scores, categoryName) && Number.isFinite(score)) {
      scores[categoryName] = score;
    }
  });
  return scores;
}

// Blendshapes relevant to gaze and to possible fatigue indicators.
export const EYE_LOOK_BLENDSHAPES = Object.freeze([
  'eyeLookInLeft',
  'eyeLookOutLeft',
  'eyeLookInRight',
  'eyeLookOutRight',
  'eyeLookUpLeft',
  'eyeLookUpRight',
  'eyeLookDownLeft',
  'eyeLookDownRight',
]);
export const FATIGUE_BLENDSHAPES = Object.freeze(['eyeBlinkLeft', 'eyeBlinkRight', 'jawOpen']);
