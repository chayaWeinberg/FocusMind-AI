import { MINIMUM_CALIBRATION_SAMPLES } from './attentionCalibrationRequirements.js';

const MAX_STANDARDIZED_DEVIATION = 4.5;
const MINIMUM_CLASSIFICATION_EVIDENCE = Math.log(2);
const MINIMUM_SINGLE_GROUP_EVIDENCE = Math.log(10);
const MINIMUM_SCALE = Number.EPSILON;

const FEATURE_GROUPS = Object.freeze([
  {
    name: 'headPose',
    fields: ['headYaw', 'headPitch', 'headRoll'],
    isValid: (measurement) => measurement.headPoseValid === true,
  },
  {
    name: 'eyeGaze',
    fields: [
      'leftEyeHorizontal',
      'leftEyeVertical',
      'rightEyeHorizontal',
      'rightEyeVertical',
    ],
    isValid: (measurement, field) => (
      field.startsWith('leftEye')
        ? measurement.leftEyeValid === true
        : measurement.rightEyeValid === true
    ),
  },
  {
    name: 'blendshapes',
    fields: [
      'eyeLookDownLeft',
      'eyeLookDownRight',
      'eyeLookUpLeft',
      'eyeLookUpRight',
      'eyeLookInLeft',
      'eyeLookOutLeft',
      'eyeLookInRight',
      'eyeLookOutRight',
    ],
    isValid: (measurement) => measurement.blendshapesValid === true,
  },
]);

const UNKNOWN_ESTIMATE = Object.freeze({
  state: 'UNKNOWN',
  reason: 'insufficient-measurements',
  availableFeatureGroups: [],
  score: null,
  calibrationDrift: false,
});

function median(values) {
  const sorted = values.slice().sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentile(sortedValues, fraction) {
  const index = (sortedValues.length - 1) * fraction;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const weight = index - lowerIndex;
  return sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight;
}

function summarize(values) {
  const center = median(values);
  const sorted = values.slice().sort((left, right) => left - right);
  const deviations = values.map((value) => Math.abs(value - center)).sort((a, b) => a - b);
  const robustSpread = Math.max(
    median(deviations) * 1.4826,
    (percentile(sorted, 0.75) - percentile(sorted, 0.25)) / 1.349,
  );
  return { center, scale: robustSpread, count: values.length };
}

function getCalibrationClasses(calibration) {
  const screenTargets = calibration.screenCalibration ?? calibration.targets ?? {};
  const offscreenTargets = calibration.offscreenTargets ?? {};
  const screenClasses = Object.entries(screenTargets).map(([label, target]) => ({
    id: `screen:${label}`,
    state: 'LOOKING_AT_SCREEN',
    samples: target.acceptedSamples ?? [],
  }));
  const offscreenClasses = Object.entries(offscreenTargets).flatMap(([label, target]) => (
    (target.acceptedSamples ?? []).reduce((classes, sample) => {
      const movementMode = sample.movementMode || 'unknown';
      const id = `away:${label}:${movementMode}`;
      let classSamples = classes.find((entry) => entry.id === id);
      if (!classSamples) {
        classSamples = { id, state: 'LOOKING_AWAY', samples: [] };
        classes.push(classSamples);
      }
      classSamples.samples.push(sample);
      return classes;
    }, [])
  ));
  const keyboardSamples = calibration.keyboardEvaluation?.acceptedSamples ?? [];
  if (keyboardSamples.length) {
    offscreenClasses.push({
      id: 'away:KEYBOARD',
      state: 'LOOKING_AWAY',
      samples: keyboardSamples,
    });
  }
  return { screenClasses, offscreenClasses };
}

function sampleHasFeature(sample, group, field) {
  const validityField = group.name === 'eyeGaze'
    ? field.startsWith('leftEye') ? 'leftEyeValid' : 'rightEyeValid'
    : group.name === 'headPose' ? 'headPoseValid' : 'blendshapesValid';
  return sample?.[validityField] === true && Number.isFinite(sample[field]);
}

function buildFeatureProfiles(classes, group, globalScales) {
  return classes.map((calibrationClass) => {
    const features = {};
    group.fields.forEach((field) => {
      const values = calibrationClass.samples
        .filter((sample) => sampleHasFeature(sample, group, field))
        .map((sample) => sample[field]);
      if (values.length < MINIMUM_CALIBRATION_SAMPLES) return;
      const statistics = summarize(values);
      features[field] = {
        center: statistics.center,
        scale: Math.max(statistics.scale, globalScales[field] * 0.05, MINIMUM_SCALE),
      };
    });
    return { ...calibrationClass, features };
  }).filter(({ features }) => Object.keys(features).length > 0);
}

function makeGroupModels(classes, group) {
  const allValuesByFeature = Object.fromEntries(group.fields.map((field) => [
    field,
    classes.flatMap(({ samples }) => samples
      .filter((sample) => sampleHasFeature(sample, group, field))
      .map((sample) => sample[field])),
  ]));
  const globalScales = Object.fromEntries(Object.entries(allValuesByFeature).map(([field, values]) => [
    field,
    values.length >= MINIMUM_CALIBRATION_SAMPLES ? summarize(values).scale : 0,
  ]));
  const screenProfiles = buildFeatureProfiles(
    classes.filter(({ state }) => state === 'LOOKING_AT_SCREEN'),
    group,
    globalScales,
  );
  const awayProfiles = buildFeatureProfiles(
    classes.filter(({ state }) => state === 'LOOKING_AWAY'),
    group,
    globalScales,
  );
  return { name: group.name, group, screenProfiles, awayProfiles };
}

function requiredOffscreenClassesPresent(offscreenTargets) {
  const requiredIds = ['LOOK_AWAY_LEFT', 'LOOK_AWAY_RIGHT', 'LOOK_AWAY_UP', 'LOOK_AWAY_DOWN']
    .flatMap((direction) => [`away:${direction}:eyes`, `away:${direction}:head`]);
  const classesById = new Map(offscreenTargets.map((entry) => [entry.id, entry]));
  return requiredIds.every((id) => (
    (classesById.get(id)?.samples.length ?? 0) >= MINIMUM_CALIBRATION_SAMPLES
  ));
}

function unknownEstimate(reason, availableFeatureGroups = [], calibrationDrift = false) {
  return {
    ...UNKNOWN_ESTIMATE,
    reason,
    availableFeatureGroups,
    calibrationDrift,
  };
}

function profileDistance(profile, measurement, group) {
  const distances = [];
  let inCoverage = true;
  for (const [field, statistics] of Object.entries(profile.features)) {
    if (!group.isValid(measurement, field) || !Number.isFinite(measurement[field])) continue;
    const deviation = Math.abs(measurement[field] - statistics.center) / statistics.scale;
    if (deviation > MAX_STANDARDIZED_DEVIATION) inCoverage = false;
    distances.push((Math.min(deviation, MAX_STANDARDIZED_DEVIATION) ** 2) / 2);
  }
  if (!distances.length) return null;
  return {
    distance: distances.reduce((sum, distance) => sum + distance, 0) / distances.length,
    inCoverage,
  };
}

function getClassDistance(model, classDefinition, measurement) {
  const groupDistances = {};
  const coverageGroups = [];
  model.groups.forEach((modelGroup) => {
    const profiles = classDefinition.state === 'LOOKING_AT_SCREEN'
      ? modelGroup.screenProfiles
      : modelGroup.awayProfiles;
    const profile = profiles.find(({ id }) => id === classDefinition.id);
    if (!profile) return;
    const distance = profileDistance(profile, measurement, modelGroup.group);
    if (!distance) return;
    groupDistances[modelGroup.name] = distance.distance;
    if (distance.inCoverage) coverageGroups.push(modelGroup.name);
  });
  const values = Object.values(groupDistances);
  if (!values.length) return null;
  return {
    distance: values.reduce((sum, value) => sum + value, 0) / values.length,
    groupDistances,
    coverageGroups,
  };
}

function bestClass(model, measurement, state) {
  let best = null;
  model.classDefinitions
    .filter((definition) => definition.state === state)
    .forEach((definition) => {
      const result = getClassDistance(model, definition, measurement);
      if (result && (!best || result.distance < best.distance)) {
        best = { ...result, definition };
      }
    });
  return best;
}

function getProfileDiagnostic(result) {
  if (!result) return null;
  return {
    id: result.definition.id,
    distance: result.distance,
    groupDistances: { ...result.groupDistances },
    coverageGroups: [...result.coverageGroups],
  };
}

function getDistanceDiagnostics(screen, away, score = null) {
  const groupEvidence = [...new Set([
    ...Object.keys(screen?.groupDistances ?? {}),
    ...Object.keys(away?.groupDistances ?? {}),
  ])].map((name) => {
    const screenDistance = screen?.groupDistances[name];
    const offscreenDistance = away?.groupDistances[name];
    return {
      featureGroup: name,
      closestScreenDistance: Number.isFinite(screenDistance) ? screenDistance : null,
      closestOffscreenDistance: Number.isFinite(offscreenDistance) ? offscreenDistance : null,
      evidence: Number.isFinite(screenDistance) && Number.isFinite(offscreenDistance)
        ? offscreenDistance - screenDistance
        : null,
    };
  });
  return {
    closestScreenProfile: getProfileDiagnostic(screen),
    closestOffscreenProfile: getProfileDiagnostic(away),
    groupEvidence,
    classificationScore: score,
    coverage: {
      screenCoverageGroups: [...(screen?.coverageGroups ?? [])],
      offscreenCoverageGroups: [...(away?.coverageGroups ?? [])],
      evaluated: Boolean(screen && away),
    },
    posture: {
      evaluated: false,
      calibrationDrift: false,
      closestHeadPoseProfile: null,
      headPoseProfileDistances: [],
    },
    conflict: {
      evaluated: false,
      detected: false,
      positiveFeatureGroups: [],
      negativeFeatureGroups: [],
    },
    thresholds: {
      maximumStandardizedDeviation: MAX_STANDARDIZED_DEVIATION,
      minimumClassificationEvidence: MINIMUM_CLASSIFICATION_EVIDENCE,
      minimumSingleGroupEvidence: MINIMUM_SINGLE_GROUP_EVIDENCE,
      activeFeatureEvidenceCutoff: 0.5,
    },
  };
}

function headPoseIsOutsideCalibration(model, measurement) {
  const poseModel = model.groups.find(({ name }) => name === 'headPose');
  if (!poseModel || !poseModel.group.isValid(measurement)) {
    return { isOutside: false, closestProfile: null, profileDistances: [] };
  }
  if (!poseModel.group.fields.every((field) => Number.isFinite(measurement[field]))) {
    return { isOutside: false, closestProfile: null, profileDistances: [] };
  }
  const profiles = [...poseModel.screenProfiles, ...poseModel.awayProfiles];
  const profileDistances = profiles.map((profile) => ({
    id: profile.id,
    ...profileDistance(
    profile,
    measurement,
    poseModel.group,
    ),
  })).filter((profile) => Number.isFinite(profile.distance));
  return {
    isOutside: !profileDistances.some(({ inCoverage }) => inCoverage),
    closestProfile: profileDistances
      .sort((left, right) => left.distance - right.distance)[0] ?? null,
    profileDistances,
  };
}

export function getPersonalizedScreenAttentionReadiness(calibration) {
  if (!calibration || typeof calibration !== 'object') {
    return {
      ready: false,
      missingRequirements: ['calibration-data'],
      calibrationSampleCounts: {},
    };
  }

  const { screenClasses, offscreenClasses } = getCalibrationClasses(calibration);
  const allClasses = [...screenClasses, ...offscreenClasses];
  const classCounts = Object.fromEntries(allClasses.map(({ id, samples }) => [
    id,
    samples.length,
  ]));
  const missingRequirements = [];
  const screenClassIds = ['CENTER', 'TOP', 'BOTTOM', 'LEFT', 'RIGHT'];
  screenClassIds.forEach((label) => {
    const count = classCounts[`screen:${label}`] ?? 0;
    if (count < MINIMUM_CALIBRATION_SAMPLES) {
      missingRequirements.push(`screen:${label}:${count}/${MINIMUM_CALIBRATION_SAMPLES}`);
    }
  });
  [
    'LOOK_AWAY_LEFT',
    'LOOK_AWAY_RIGHT',
    'LOOK_AWAY_UP',
    'LOOK_AWAY_DOWN',
  ].forEach((label) => {
    ['eyes', 'head'].forEach((movementMode) => {
      const id = `away:${label}:${movementMode}`;
      const count = classCounts[id] ?? 0;
      if (count < MINIMUM_CALIBRATION_SAMPLES) {
        missingRequirements.push(`${id}:${count}/${MINIMUM_CALIBRATION_SAMPLES}`);
      }
    });
  });

  if (missingRequirements.length === 0) {
    FEATURE_GROUPS.forEach((group) => {
      const modelGroup = makeGroupModels(allClasses, group);
      if (!modelGroup.screenProfiles.length || !modelGroup.awayProfiles.length) {
        missingRequirements.push(`feature-group:${group.name}`);
      }
    });
  }
  return {
    ready: missingRequirements.length === 0,
    missingRequirements,
    calibrationSampleCounts: classCounts,
  };
}

export function createPersonalizedScreenAttentionModel(calibration) {
  if (!calibration || typeof calibration !== 'object') return null;
  const { screenClasses, offscreenClasses } = getCalibrationClasses(calibration);
  if (!getPersonalizedScreenAttentionReadiness(calibration).ready) return null;

  const classes = [...screenClasses, ...offscreenClasses];
  const groups = FEATURE_GROUPS
    .map((group) => makeGroupModels(classes, group))
    .filter(({ screenProfiles, awayProfiles }) => screenProfiles.length && awayProfiles.length);
  if (!groups.some(({ name }) => name === 'headPose')
    || !groups.some(({ name }) => name === 'eyeGaze')
    || !groups.some(({ name }) => name === 'blendshapes')) {
    return null;
  }
  return {
    groups,
    classDefinitions: classes.map(({ id, state }) => ({ id, state })),
  };
}

export function classifyPersonalizedScreenAttention(model, measurement) {
  if (!model) {
    return {
      ...unknownEstimate('calibration-unavailable'),
      diagnostics: {
        ...getDistanceDiagnostics(null, null),
        decision: { reason: 'calibration-unavailable', activeEvidence: [], hasCoverage: false },
      },
    };
  }
  if (!measurement?.faceDetected) {
    return {
      ...unknownEstimate('face-not-detected'),
      diagnostics: {
        ...getDistanceDiagnostics(null, null),
        decision: { reason: 'face-not-detected', activeEvidence: [], hasCoverage: false },
      },
    };
  }
  const posture = headPoseIsOutsideCalibration(model, measurement);

  const screen = bestClass(model, measurement, 'LOOKING_AT_SCREEN');
  const away = bestClass(model, measurement, 'LOOKING_AWAY');
  if (posture.isOutside) {
    return {
      ...unknownEstimate('calibration-drift', [], true),
      diagnostics: {
        ...getDistanceDiagnostics(screen, away),
        posture: {
          evaluated: true,
          calibrationDrift: true,
          closestHeadPoseProfile: posture.closestProfile,
          headPoseProfileDistances: posture.profileDistances,
        },
        coverage: {
          screenCoverageGroups: [...(screen?.coverageGroups ?? [])],
          offscreenCoverageGroups: [...(away?.coverageGroups ?? [])],
          evaluated: Boolean(screen && away),
        },
        decision: {
          reason: 'calibration-drift',
          activeEvidence: [],
          hasCoverage: false,
        },
      },
    };
  }
  if (!screen || !away) {
    return {
      ...unknownEstimate('insufficient-measurements'),
      diagnostics: {
        ...getDistanceDiagnostics(screen, away),
        decision: {
          reason: 'insufficient-measurements',
          activeEvidence: [],
          hasCoverage: Boolean(screen?.coverageGroups.length || away?.coverageGroups.length),
        },
        coverage: {
          screenCoverageGroups: [...(screen?.coverageGroups ?? [])],
          offscreenCoverageGroups: [...(away?.coverageGroups ?? [])],
          evaluated: Boolean(screen && away),
        },
        posture: {
          evaluated: true,
          calibrationDrift: false,
          closestHeadPoseProfile: posture.closestProfile,
          headPoseProfileDistances: posture.profileDistances,
        },
      },
    };
  }

  const availableFeatureGroups = model.groups
    .filter((modelGroup) => modelGroup.group.fields.some((field) => (
      modelGroup.group.isValid(measurement, field)
      && Number.isFinite(measurement[field])
    )))
    .map(({ name }) => name);
  const groupEvidence = model.groups.map(({ name }) => {
    const screenDistance = screen.groupDistances[name];
    const awayDistance = away.groupDistances[name];
    return Number.isFinite(screenDistance) && Number.isFinite(awayDistance)
      ? awayDistance - screenDistance
      : null;
  }).filter(Number.isFinite);
  const activeEvidence = groupEvidence.filter((value) => Math.abs(value) > 0.5);
  const positiveGroups = activeEvidence.filter((value) => value > 0);
  const negativeGroups = activeEvidence.filter((value) => value < 0);
  const activeScore = activeEvidence.length
    ? activeEvidence.reduce((sum, value) => sum + value, 0) / activeEvidence.length
    : 0;
  if (positiveGroups.length && negativeGroups.length) {
    return {
      ...unknownEstimate('conflicting-feature-evidence', availableFeatureGroups),
      score: activeScore,
      diagnostics: {
        ...getDistanceDiagnostics(screen, away, activeScore),
        decision: {
          reason: 'conflicting-feature-evidence',
          activeEvidence,
          minimumEvidence: null,
          hasCoverage: null,
        },
        conflict: {
          evaluated: true,
          detected: true,
          positiveFeatureGroups: model.groups
            .filter(({ name }) => {
              const screenDistance = screen.groupDistances[name];
              const awayDistance = away.groupDistances[name];
              return Number.isFinite(screenDistance)
                && Number.isFinite(awayDistance)
                && awayDistance - screenDistance > 0.5;
            })
            .map(({ name }) => name),
          negativeFeatureGroups: model.groups
            .filter(({ name }) => {
              const screenDistance = screen.groupDistances[name];
              const awayDistance = away.groupDistances[name];
              return Number.isFinite(screenDistance)
                && Number.isFinite(awayDistance)
                && awayDistance - screenDistance < -0.5;
            })
            .map(({ name }) => name),
        },
        posture: {
          evaluated: true,
          calibrationDrift: false,
          closestHeadPoseProfile: posture.closestProfile,
          headPoseProfileDistances: posture.profileDistances,
        },
      },
    };
  }

  const singleGroup = activeEvidence.length === 1;
  const minimumEvidence = singleGroup
    ? MINIMUM_SINGLE_GROUP_EVIDENCE
    : MINIMUM_CLASSIFICATION_EVIDENCE;
  const nearest = activeScore > 0 ? screen : away;
  if (
    Math.abs(activeScore) < minimumEvidence
    || !nearest.coverageGroups.length
  ) {
    return {
      ...unknownEstimate(
        nearest.coverageGroups.length ? 'ambiguous-calibration-match' : 'outside-calibration-coverage',
        availableFeatureGroups,
      ),
      score: activeScore,
      diagnostics: {
        ...getDistanceDiagnostics(screen, away, activeScore),
        decision: {
          reason: nearest.coverageGroups.length
            ? 'ambiguous-calibration-match'
            : 'outside-calibration-coverage',
          activeEvidence,
          minimumEvidence,
          hasCoverage: Boolean(nearest.coverageGroups.length),
          selectedState: nearest === screen ? 'LOOKING_AT_SCREEN' : 'LOOKING_AWAY',
        },
        coverage: {
          screenCoverageGroups: [...screen.coverageGroups],
          offscreenCoverageGroups: [...away.coverageGroups],
          evaluated: true,
          selectedState: nearest === screen ? 'LOOKING_AT_SCREEN' : 'LOOKING_AWAY',
          selectedCoverageGroups: [...nearest.coverageGroups],
        },
        posture: {
          evaluated: true,
          calibrationDrift: false,
          closestHeadPoseProfile: posture.closestProfile,
          headPoseProfileDistances: posture.profileDistances,
        },
      },
    };
  }
  return {
    state: activeScore > 0 ? 'LOOKING_AT_SCREEN' : 'LOOKING_AWAY',
    reason: null,
    availableFeatureGroups,
    score: activeScore,
    calibrationDrift: false,
    diagnostics: {
      ...getDistanceDiagnostics(screen, away, activeScore),
      decision: {
        reason: null,
        activeEvidence,
        minimumEvidence,
        hasCoverage: true,
        selectedState: activeScore > 0 ? 'LOOKING_AT_SCREEN' : 'LOOKING_AWAY',
      },
      coverage: {
        screenCoverageGroups: [...screen.coverageGroups],
        offscreenCoverageGroups: [...away.coverageGroups],
        evaluated: true,
        selectedState: activeScore > 0 ? 'LOOKING_AT_SCREEN' : 'LOOKING_AWAY',
        selectedCoverageGroups: [...nearest.coverageGroups],
      },
      posture: {
        evaluated: true,
        calibrationDrift: false,
        closestHeadPoseProfile: posture.closestProfile,
        headPoseProfileDistances: posture.profileDistances,
      },
    },
  };
}

export function createPersonalizedAttentionSmoother({
  transitionHoldMs = 500,
  unknownHoldMs = 500,
} = {}) {
  if (
    !Number.isFinite(transitionHoldMs)
    || transitionHoldMs < 0
    || !Number.isFinite(unknownHoldMs)
    || unknownHoldMs < 0
  ) {
    throw new TypeError('Attention smoothing durations must be finite and non-negative.');
  }

  let state = 'UNKNOWN';
  let candidateState = null;
  let candidateStartedAt = null;
  let unknownStartedAt = null;
  let lastTimestamp = null;

  function addSample(estimate, timestamp) {
    if (!Number.isFinite(timestamp)) {
      throw new TypeError('Attention sample timestamp must be finite.');
    }
    if (lastTimestamp !== null && timestamp <= lastTimestamp) {
      throw new RangeError('Attention sample timestamps must increase monotonically.');
    }
    if (lastTimestamp !== null && timestamp - lastTimestamp > 600) {
      state = 'UNKNOWN';
      candidateState = null;
      candidateStartedAt = null;
      unknownStartedAt = null;
    }
    lastTimestamp = timestamp;

    const nextState = estimate?.state;
    if (nextState !== 'LOOKING_AT_SCREEN' && nextState !== 'LOOKING_AWAY') {
      candidateState = null;
      candidateStartedAt = null;
      if (
        estimate?.reason === 'face-not-detected'
        || estimate?.reason === 'calibration-drift'
        || estimate?.reason === 'outside-calibration-coverage'
      ) {
        state = 'UNKNOWN';
        unknownStartedAt = null;
        return state;
      }
      if (state === 'UNKNOWN') return state;
      if (unknownStartedAt === null) unknownStartedAt = timestamp;
      if (timestamp - unknownStartedAt >= unknownHoldMs) state = 'UNKNOWN';
      return state;
    }

    unknownStartedAt = null;
    if (nextState === state) {
      candidateState = null;
      candidateStartedAt = null;
      return state;
    }
    if (transitionHoldMs === 0) {
      state = nextState;
      candidateState = null;
      candidateStartedAt = null;
      return state;
    }
    if (candidateState !== nextState) {
      candidateState = nextState;
      candidateStartedAt = timestamp;
      return state;
    }
    if (timestamp - candidateStartedAt >= transitionHoldMs) {
      state = nextState;
      candidateState = null;
      candidateStartedAt = null;
    }
    return state;
  }

  function reset() {
    state = 'UNKNOWN';
    candidateState = null;
    candidateStartedAt = null;
    unknownStartedAt = null;
    lastTimestamp = null;
  }

  function getSnapshot() {
    return {
      state,
      candidateState,
      candidateStartedAt,
      unknownStartedAt,
      lastTimestamp,
      transitionHoldMs,
      unknownHoldMs,
    };
  }

  return { addSample, reset, getSnapshot };
}
