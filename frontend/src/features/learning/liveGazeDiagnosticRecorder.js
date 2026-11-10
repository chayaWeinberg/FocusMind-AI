const VALID_STATES = new Set(['LOOKING_AT_SCREEN', 'LOOKING_AWAY', 'UNKNOWN']);

function countStates(samples, field) {
  return samples.reduce((counts, sample) => {
    const state = sample[field];
    counts[state] = (counts[state] || 0) + 1;
    return counts;
  }, { LOOKING_AT_SCREEN: 0, LOOKING_AWAY: 0, UNKNOWN: 0 });
}

function cloneSample(sample) {
  return JSON.parse(JSON.stringify(sample));
}

export function createLiveGazeDiagnosticRecorder() {
  let startedAt = null;
  let stoppedAt = null;
  let activeStage = null;
  let samples = [];
  let stages = [];

  function start(timestamp) {
    if (!Number.isFinite(timestamp)) {
      throw new TypeError('Diagnostic recording start time must be finite.');
    }
    startedAt = timestamp;
    stoppedAt = null;
    activeStage = null;
    samples = [];
    stages = [];
    return true;
  }

  function setStage(stage, timestamp) {
    if (startedAt === null || stoppedAt !== null) return false;
    if (!stage || typeof stage.id !== 'string' || typeof stage.expectedLabel !== 'string') {
      throw new TypeError('Diagnostic stage must have an id and expected label.');
    }
    if (!Number.isFinite(timestamp)) {
      throw new TypeError('Diagnostic stage timestamp must be finite.');
    }
    activeStage = {
      id: stage.id,
      expectedLabel: stage.expectedLabel,
      expectedState: stage.expectedState,
      startedAt: timestamp,
      endedAt: null,
    };
    stages.push(activeStage);
    return true;
  }

  function endStage(timestamp) {
    if (!activeStage || stoppedAt !== null) return false;
    if (!Number.isFinite(timestamp)) {
      throw new TypeError('Diagnostic stage end time must be finite.');
    }
    activeStage.endedAt = timestamp;
    activeStage = null;
    return true;
  }

  function record(sample, timestamp) {
    if (startedAt === null || stoppedAt !== null || !activeStage) return false;
    if (!Number.isFinite(timestamp)) {
      throw new TypeError('Diagnostic sample timestamp must be finite.');
    }
    if (!VALID_STATES.has(sample?.rawClassifierState)
      || !VALID_STATES.has(sample?.smoothedState)) {
      throw new TypeError('Diagnostic sample classifier states must be valid.');
    }
    samples.push({
      timestampMs: timestamp - startedAt,
      expectedStage: activeStage.id,
      expectedLabel: activeStage.expectedLabel,
      expectedState: activeStage.expectedState,
      ...cloneSample(sample),
    });
    return true;
  }

  function stop(timestamp) {
    if (startedAt === null || stoppedAt !== null) return false;
    if (!Number.isFinite(timestamp)) {
      throw new TypeError('Diagnostic recording stop time must be finite.');
    }
    if (activeStage) endStage(timestamp);
    stoppedAt = timestamp;
    return true;
  }

  function getSnapshot() {
    const stageSummaries = stages.map((stage) => {
      const stageSamples = samples.filter((sample) => sample.expectedStage === stage.id);
      return {
        id: stage.id,
        expectedLabel: stage.expectedLabel,
        expectedState: stage.expectedState,
        startedAtMs: stage.startedAt - startedAt,
        endedAtMs: Number.isFinite(stage.endedAt) ? stage.endedAt - startedAt : null,
        sampleCount: stageSamples.length,
        rawClassifierStateCounts: countStates(stageSamples, 'rawClassifierState'),
        smoothedStateCounts: countStates(stageSamples, 'smoothedState'),
      };
    });
    return {
      schemaVersion: 1,
      dataScope: 'browser-memory-only',
      startedAtMs: startedAt,
      stoppedAtMs: stoppedAt,
      recording: startedAt !== null && stoppedAt === null,
      activeStage: activeStage ? { ...activeStage } : null,
      stageSummaries,
      sampleCount: samples.length,
      samples: samples.map((sample) => cloneSample(sample)),
    };
  }

  function serialize() {
    return JSON.stringify(getSnapshot(), null, 2);
  }

  return { start, setStage, endStage, record, stop, getSnapshot, serialize };
}
