import { act, render, waitFor } from '@testing-library/react';
import { useCallback, useEffect, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useFaceLandmarker from './useFaceLandmarker.js';

const mediapipeMocks = vi.hoisted(() => ({
  forVisionTasks: vi.fn(),
  createFromOptions: vi.fn(),
  detectForVideo: vi.fn(),
  close: vi.fn(),
}));

vi.mock('@mediapipe/tasks-vision', () => ({
  FaceLandmarker: { createFromOptions: mediapipeMocks.createFromOptions },
  FilesetResolver: { forVisionTasks: mediapipeMocks.forVisionTasks },
}));

function createDeferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createStream() {
  const listeners = new Map();
  const track = {
    readyState: 'live',
    addEventListener: vi.fn((name, listener) => listeners.set(name, listener)),
    removeEventListener: vi.fn((name) => listeners.delete(name)),
    end() {
      track.readyState = 'ended';
      listeners.get('ended')?.();
    },
  };
  return {
    stream: { getVideoTracks: () => [track] },
    track,
  };
}

function HookHarness({
  stream,
  onResults,
  onRender,
  trackingEnabled = true,
  supportsVideoFrameCallbacks = true,
}) {
  const videoRef = useRef(null);
  const onRenderRef = useRef(onRender);
  onRenderRef.current = onRender;
  const {
    status,
    error,
    latestPoseRef,
    latestEyeGazeRef,
    latestEyeLookBlendshapesRef,
    latestDetectionSampleRef,
    latestEyeMovementSummaryRef,
    latestScreenAttentionSummaryRef,
    screenAttentionRecorderRef,
    screenCalibrationSessionRef,
    startDiagnosticRecording,
    stopDiagnosticRecording,
    resetDiagnosticRecording,
    startCalibration,
    startGuidedCalibration,
    cancelCalibration,
    restartCalibration,
    repeatCalibrationTarget,
    startKeyboardEvaluation,
    completeCalibration,
    liveGazeDiagnosticRecorderRef,
    startLiveGazeDiagnosticRecording,
    setLiveGazeDiagnosticStage,
    endLiveGazeDiagnosticStage,
    stopLiveGazeDiagnosticRecording,
  } = useFaceLandmarker(videoRef, stream, onResults, trackingEnabled);
  useEffect(() => {
    onRenderRef.current?.(
      status,
      error,
      latestPoseRef,
      latestDetectionSampleRef,
      latestEyeGazeRef,
      latestEyeLookBlendshapesRef,
      latestEyeMovementSummaryRef,
      latestScreenAttentionSummaryRef,
      screenAttentionRecorderRef,
      startDiagnosticRecording,
      stopDiagnosticRecording,
      resetDiagnosticRecording,
      screenCalibrationSessionRef,
      startCalibration,
      cancelCalibration,
      restartCalibration,
      repeatCalibrationTarget,
      startKeyboardEvaluation,
      completeCalibration,
      startGuidedCalibration,
      liveGazeDiagnosticRecorderRef,
      startLiveGazeDiagnosticRecording,
      setLiveGazeDiagnosticStage,
      endLiveGazeDiagnosticStage,
      stopLiveGazeDiagnosticRecording,
    );
  }, [
    status,
    error,
    latestPoseRef,
    latestDetectionSampleRef,
    latestEyeGazeRef,
    latestEyeLookBlendshapesRef,
    latestEyeMovementSummaryRef,
    latestScreenAttentionSummaryRef,
    screenAttentionRecorderRef,
    startDiagnosticRecording,
    stopDiagnosticRecording,
    resetDiagnosticRecording,
    screenCalibrationSessionRef,
    startCalibration,
    startGuidedCalibration,
    cancelCalibration,
    restartCalibration,
    repeatCalibrationTarget,
    startKeyboardEvaluation,
    completeCalibration,
    liveGazeDiagnosticRecorderRef,
    startLiveGazeDiagnosticRecording,
    setLiveGazeDiagnosticStage,
    endLiveGazeDiagnosticStage,
    stopLiveGazeDiagnosticRecording,
  ]);

  const setVideo = useCallback((video) => {
    if (!video) return;
    Object.defineProperties(video, {
      readyState: { configurable: true, value: HTMLMediaElement.HAVE_CURRENT_DATA },
      videoWidth: { configurable: true, value: 640 },
      videoHeight: { configurable: true, value: 480 },
      paused: { configurable: true, value: false },
      currentTime: { configurable: true, writable: true, value: 1 },
    });

    if (supportsVideoFrameCallbacks) {
      video.frameCallbacks = new Map();
      video.nextFrameCallbackId = 0;
      video.requestVideoFrameCallback = vi.fn((callback) => {
        video.nextFrameCallbackId += 1;
        video.frameCallbacks.set(video.nextFrameCallbackId, callback);
        return video.nextFrameCallbackId;
      });
      video.cancelVideoFrameCallback = vi.fn((id) => video.frameCallbacks.delete(id));
    }
    videoRef.current = video;
  }, []);

  return <video ref={setVideo} />;
}

async function findVideo(container) {
  const video = container.querySelector('video');
  await waitFor(() => expect(mediapipeMocks.createFromOptions).toHaveBeenCalledTimes(1));
  return video;
}

function fireNextVideoFrame(video, now = 1000) {
  const callback = [...video.frameCallbacks.values()][0];
  if (!callback) throw new Error('No scheduled video frame callback');
  video.frameCallbacks.clear();
  act(() => callback(now, { mediaTime: video.currentTime }));
}

function createEyeLandmarks(horizontalShift = 0) {
  const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const setEye = ({ iris, outer, inner, upper, lower, centerX }) => {
    landmarks[outer] = { x: centerX - 0.05, y: 0.5, z: 0 };
    landmarks[inner] = { x: centerX + 0.05, y: 0.5, z: 0 };
    landmarks[upper] = { x: centerX, y: 0.48, z: 0 };
    landmarks[lower] = { x: centerX, y: 0.52, z: 0 };
    landmarks[iris] = { x: centerX + horizontalShift, y: 0.5, z: 0 };
  };
  setEye({ iris: 468, outer: 33, inner: 133, upper: 159, lower: 145, centerX: 0.35 });
  setEye({ iris: 473, outer: 263, inner: 362, upper: 386, lower: 374, centerX: 0.65 });
  return landmarks;
}

function createEyeLookBlendshapes() {
  return {
    categories: [
      { categoryName: 'eyeLookInLeft', score: 0.11 },
      { categoryName: 'eyeLookOutLeft', score: 0.22 },
      { categoryName: 'eyeLookInRight', score: 0.33 },
      { categoryName: 'eyeLookOutRight', score: 0.44 },
      { categoryName: 'eyeLookUpLeft', score: 0.55 },
      { categoryName: 'eyeLookUpRight', score: 0.66 },
      { categoryName: 'eyeLookDownLeft', score: 0.77 },
      { categoryName: 'eyeLookDownRight', score: 0.88 },
    ],
  };
}

describe('useFaceLandmarker', () => {
  let visibilityDescriptor;

  beforeEach(() => {
    vi.clearAllMocks();
    visibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mediapipeMocks.forVisionTasks.mockResolvedValue({ vision: true });
    mediapipeMocks.detectForVideo.mockReset();
    mediapipeMocks.detectForVideo.mockReturnValue({ faceLandmarks: [] });
    mediapipeMocks.close.mockReset();
    mediapipeMocks.createFromOptions.mockResolvedValue({
      detectForVideo: mediapipeMocks.detectForVideo,
      close: mediapipeMocks.close,
    });
  });

  afterEach(() => {
    if (visibilityDescriptor) {
      Object.defineProperty(document, 'visibilityState', visibilityDescriptor);
    } else {
      delete document.visibilityState;
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('initializes one VIDEO landmarker with the local WASM and model paths', async () => {
    const { stream } = createStream();
    const getUserMedia = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
    const { container } = render(<HookHarness stream={stream} />);

    await findVideo(container);

    expect(mediapipeMocks.forVisionTasks).toHaveBeenCalledWith('/mediapipe/wasm');
    expect(mediapipeMocks.createFromOptions).toHaveBeenCalledWith(
      { vision: true },
      {
        baseOptions: { modelAssetPath: '/models/face_landmarker.task' },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFacialTransformationMatrixes: true,
        outputFaceBlendshapes: true,
      },
    );
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('processes ready frames no faster than approximately five frames per second', async () => {
    const { stream } = createStream();
    const onResults = vi.fn();
    const { container } = render(<HookHarness stream={stream} onResults={onResults} />);
    const video = await findVideo(container);

    fireNextVideoFrame(video, 1000);
    expect(mediapipeMocks.detectForVideo).toHaveBeenCalledTimes(1);
    expect(mediapipeMocks.detectForVideo).toHaveBeenCalledWith(video, 1000);
    expect(onResults).toHaveBeenCalledWith({ faceLandmarks: [] });

    video.currentTime = 2;
    fireNextVideoFrame(video, 1199);
    expect(mediapipeMocks.detectForVideo).toHaveBeenCalledTimes(1);

    video.currentTime = 3;
    fireNextVideoFrame(video, 1200);
    expect(mediapipeMocks.detectForVideo).toHaveBeenCalledTimes(2);
  });

  it('updates status only when actual MediaPipe results change face presence', async () => {
    const { stream } = createStream();
    const statuses = [];
    let renderCount = 0;
    mediapipeMocks.detectForVideo
      .mockReturnValueOnce({ faceLandmarks: [] })
      .mockReturnValueOnce({ faceLandmarks: [] })
      .mockReturnValueOnce({ faceLandmarks: [[{ x: 0.5, y: 0.5, z: 0 }]] });
    const { container } = render(
      <HookHarness
        stream={stream}
        onRender={(status) => {
          renderCount += 1;
          statuses.push(status);
        }}
      />,
    );
    const video = await findVideo(container);

    video.currentTime = 1;
    fireNextVideoFrame(video, 1000);
    await waitFor(() => expect(statuses.at(-1)).toBe('no-face'));
    const rendersAfterNoFace = renderCount;

    video.currentTime = 2;
    fireNextVideoFrame(video, 1200);
    expect(renderCount).toBe(rendersAfterNoFace);

    video.currentTime = 3;
    fireNextVideoFrame(video, 1400);
    await waitFor(() => expect(statuses.at(-1)).toBe('detected'));
  });

  it('stores the estimated head pose from the actual MediaPipe transformation matrix in a ref', async () => {
    const { stream } = createStream();
    const actualMatrix = {
      rows: 4,
      columns: 4,
      data: [
        Math.cos(Math.PI / 6), 0, 0.5, 0,
        0, 1, 0, 0,
        -0.5, 0, Math.cos(Math.PI / 6), 0,
        0, 0, 0, 1,
      ],
    };
    mediapipeMocks.detectForVideo.mockReturnValue({
      faceLandmarks: [[{ x: 0.4, y: 0.5, z: 0 }]],
      facialTransformationMatrixes: [actualMatrix],
    });
    const renders = [];
    const onRender = (status, error, poseRef, detectionSampleRef) => {
      renders.push({ status, error, poseRef, detectionSampleRef });
    };
    const { container } = render(<HookHarness stream={stream} onRender={onRender} />);
    const video = await findVideo(container);

    fireNextVideoFrame(video, 1000);

    await waitFor(() => expect(renders.at(-1).status).toBe('detected'));
    expect(renders.at(-1).poseRef.current.yaw).toBeCloseTo(-30, 5);
    expect(renders.at(-1).poseRef.current.pitch).toBeCloseTo(0, 5);
    expect(renders.at(-1).poseRef.current.roll).toBeCloseTo(0, 5);
    expect(renders.at(-1).poseRef.current.direction).toBe('right');
    expect(renders.at(-1).detectionSampleRef.current).toEqual({
      matrix: actualMatrix,
      pose: renders.at(-1).poseRef.current,
    });
  });

  it('stores eye gaze from the existing MediaPipe landmarks and clears it when no face is detected', async () => {
    const { stream, track } = createStream();
    mediapipeMocks.detectForVideo
      .mockReturnValueOnce({ faceLandmarks: [createEyeLandmarks(-0.02)] })
      .mockReturnValueOnce({ faceLandmarks: [] });
    const renders = [];
    const onRender = (
      status,
      error,
      poseRef,
      sampleRef,
      eyeGazeRef,
      blendshapesRef,
      movementSummaryRef,
    ) => {
      renders.push({
        status,
        error,
        poseRef,
        sampleRef,
        eyeGazeRef,
        blendshapesRef,
        movementSummaryRef,
      });
    };
    const { container } = render(<HookHarness stream={stream} onRender={onRender} />);
    const video = await findVideo(container);

    video.currentTime = 1;
    fireNextVideoFrame(video, 1000);
    await waitFor(() => expect(renders.at(-1).status).toBe('detected'));
    expect(renders.at(-1).eyeGazeRef.current.horizontal).toBeCloseTo(-0.4, 5);
    expect(renders.at(-1).eyeGazeRef.current).toMatchObject({
      vertical: 0,
      direction: 'right',
      reliability: 'reliable',
    });
    expect(renders.at(-1).blendshapesRef.current).toBeNull();

    video.currentTime = 2;
    fireNextVideoFrame(video, 1200);
    await waitFor(() => expect(renders.at(-1).status).toBe('no-face'));
    expect(renders.at(-1).eyeGazeRef.current).toMatchObject({
      horizontal: null,
      vertical: null,
      direction: 'unknown',
      reliability: 'unreliable',
      reason: 'no-face',
    });
    expect(renders.at(-1).blendshapesRef.current).toBeNull();

    act(() => track.end());
    expect(renders.at(-1).eyeGazeRef.current).toBeNull();
  });

  it('updates movement summaries from the existing inference loop and resets them when the track ends', async () => {
    const { stream, track } = createStream();
    mediapipeMocks.detectForVideo
      .mockReturnValueOnce({ faceLandmarks: [createEyeLandmarks(0)] })
      .mockReturnValueOnce({ faceLandmarks: [createEyeLandmarks(0)] })
      .mockReturnValueOnce({ faceLandmarks: [createEyeLandmarks(0)] })
      .mockReturnValueOnce({ faceLandmarks: [createEyeLandmarks(0.025)] })
      .mockReturnValueOnce({ faceLandmarks: [createEyeLandmarks(0.025)] })
      .mockReturnValueOnce({ faceLandmarks: [createEyeLandmarks(0.025)] });
    const renders = [];
    const onRender = (
      status,
      error,
      poseRef,
      sampleRef,
      gazeRef,
      blendshapesRef,
      movementSummaryRef,
      attentionSummaryRef,
    ) => {
      renders.push({ status, movementSummaryRef, attentionSummaryRef });
    };
    const { container } = render(<HookHarness stream={stream} onRender={onRender} />);
    const video = await findVideo(container);

    for (let index = 0; index < 6; index += 1) {
      video.currentTime = index + 1;
      fireNextVideoFrame(video, 1000 + index * 200);
    }

    expect(renders.at(-1).movementSummaryRef.current).toMatchObject({
      validMeasurements: 6,
      totalMeasurements: 6,
      reliablePercentage: 100,
      significantMovementCount: 1,
      insufficientData: false,
    });
    expect(renders.at(-1).attentionSummaryRef.current).toMatchObject({
      currentState: 'UNKNOWN',
      sampleCount: 6,
    });

    act(() => track.end());
    expect(renders.at(-1).movementSummaryRef.current).toBeNull();
    expect(renders.at(-1).attentionSummaryRef.current).toBeNull();
  });

  it('collects movement samples only while enabled and starts with a fresh window after resuming', async () => {
    const { stream } = createStream();
    mediapipeMocks.detectForVideo.mockReturnValue({
      faceLandmarks: [createEyeLandmarks(0)],
    });
    const renders = [];
    const onRender = (
      status,
      error,
      poseRef,
      sampleRef,
      gazeRef,
      blendshapesRef,
      movementSummaryRef,
      attentionSummaryRef,
    ) => renders.push({ movementSummaryRef, attentionSummaryRef });
    const { container, rerender } = render(
      <HookHarness stream={stream} onRender={onRender} trackingEnabled={false} />,
    );
    const video = await findVideo(container);

    for (let index = 0; index < 5; index += 1) {
      video.currentTime = index + 1;
      fireNextVideoFrame(video, 1000 + index * 200);
    }
    expect(renders.at(-1).movementSummaryRef.current).toBeNull();
    expect(renders.at(-1).attentionSummaryRef.current).toBeNull();

    rerender(<HookHarness stream={stream} onRender={onRender} trackingEnabled />);
    for (let index = 0; index < 5; index += 1) {
      video.currentTime = index + 6;
      fireNextVideoFrame(video, 2000 + index * 200);
    }
    expect(renders.at(-1).movementSummaryRef.current).toMatchObject({
      validMeasurements: 5,
      totalMeasurements: 5,
    });
    expect(renders.at(-1).attentionSummaryRef.current.sampleCount).toBe(5);

    rerender(<HookHarness stream={stream} onRender={onRender} trackingEnabled={false} />);
    expect(renders.at(-1).movementSummaryRef.current).toBeNull();
    expect(renders.at(-1).attentionSummaryRef.current).toBeNull();
    rerender(<HookHarness stream={stream} onRender={onRender} trackingEnabled />);
    for (let index = 0; index < 5; index += 1) {
      video.currentTime = index + 11;
      fireNextVideoFrame(video, 3000 + index * 200);
    }
    expect(renders.at(-1).movementSummaryRef.current).toMatchObject({
      validMeasurements: 5,
      totalMeasurements: 5,
    });
    expect(renders.at(-1).attentionSummaryRef.current.sampleCount).toBe(5);
  });

  it('estimates screen attention from head pose and gaze in the same MediaPipe result', async () => {
    const { stream, track } = createStream();
    const neutralMatrix = {
      rows: 4,
      columns: 4,
      data: [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ],
    };
    mediapipeMocks.detectForVideo.mockReturnValue({
      faceLandmarks: [createEyeLandmarks(0)],
      facialTransformationMatrixes: [neutralMatrix],
    });
    const renders = [];
    const onRender = (
      status,
      error,
      poseRef,
      sampleRef,
      gazeRef,
      blendshapesRef,
      movementSummaryRef,
      attentionSummaryRef,
    ) => renders.push({ attentionSummaryRef });
    const { container } = render(<HookHarness stream={stream} onRender={onRender} />);
    const video = await findVideo(container);

    [1000, 1200, 1400].forEach((timestamp, index) => {
      video.currentTime = index + 1;
      fireNextVideoFrame(video, timestamp);
    });

    expect(renders.at(-1).attentionSummaryRef.current).toMatchObject({
      currentState: 'LIKELY_ON_SCREEN',
      measurementQuality: 'reliable',
      sampleCount: 3,
    });

    act(() => track.end());
  });

  it('records synchronized pose, gaze, blendshape, and attention outputs then auto-stops after ten seconds', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(5000);
    const { stream, track } = createStream();
    const neutralMatrix = {
      rows: 4,
      columns: 4,
      data: [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ],
    };
    mediapipeMocks.detectForVideo.mockReturnValue({
      faceLandmarks: [createEyeLandmarks(0)],
      facialTransformationMatrixes: [neutralMatrix],
      faceBlendshapes: [createEyeLookBlendshapes()],
    });
    let recorderRef;
    let startRecording;
    let stopRecording;
    let resetRecording;
    const onRender = (
      status,
      error,
      poseRef,
      sampleRef,
      gazeRef,
      blendshapesRef,
      movementSummaryRef,
      attentionSummaryRef,
      nextRecorderRef,
      start,
      stop,
      reset,
    ) => {
      recorderRef = nextRecorderRef;
      startRecording = start;
      stopRecording = stop;
      resetRecording = reset;
    };
    const { container } = render(<HookHarness stream={stream} onRender={onRender} />);
    const video = await findVideo(container);

    vi.useFakeTimers();
    act(() => {
      expect(startRecording()).toBe(true);
    });
    const recordingStart = recorderRef.current.getSnapshot().startedAt;
    video.currentTime = 1;
    fireNextVideoFrame(video, 5100);

    expect(recorderRef.current.getSnapshot()).toMatchObject({
      recording: true,
      totalSamples: 1,
    });
    expect(recorderRef.current.getSnapshot().samples[0]).toMatchObject({
      timestampMs: 5100 - recordingStart,
      headPitch: 0,
      eyeMeasurementReliability: 'reliable',
      eyeReliabilityReason: 'Reason unavailable',
      combinedYaw: 0,
      combinedPitch: 0,
      screenAttentionState: 'LIKELY_ON_SCREEN',
      screenAttentionReason: 'Reason unavailable',
      eyeLookDownLeft: 0.77,
      eyeLookDownRight: 0.88,
    });
    expect(recorderRef.current.getSnapshot().samples[0].headYaw).toBeCloseTo(0);

    act(() => vi.advanceTimersByTime(10_000));
    expect(recorderRef.current.getSnapshot().recording).toBe(false);
    expect(recorderRef.current.getSnapshot().totalSamples).toBe(1);
    act(() => track.end());
    expect(stopRecording).toBeTypeOf('function');
    expect(resetRecording).toBeTypeOf('function');
  });

  it('does not start a diagnostic recording while playback tracking is disabled', async () => {
    const { stream } = createStream();
    let startRecording;
    const onRender = (
      status,
      error,
      poseRef,
      sampleRef,
      gazeRef,
      blendshapesRef,
      movementSummaryRef,
      attentionSummaryRef,
      recorderRef,
      start,
    ) => {
      startRecording = start;
    };
    const { container } = render(
      <HookHarness stream={stream} onRender={onRender} trackingEnabled={false} />,
    );
    await findVideo(container);

    act(() => expect(startRecording()).toBe(false));
  });

  it('collects calibration samples from one inference result and stops on playback interruption', async () => {
    const { stream, track } = createStream();
    const neutralMatrix = {
      rows: 4,
      columns: 4,
      data: [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ],
    };
    mediapipeMocks.detectForVideo.mockReturnValue({
      faceLandmarks: [createEyeLandmarks(0)],
      facialTransformationMatrixes: [neutralMatrix],
      faceBlendshapes: [createEyeLookBlendshapes()],
    });
    let calibrationSessionRef;
    let startCalibration;
    const onRender = (
      status,
      error,
      poseRef,
      sampleRef,
      gazeRef,
      blendshapesRef,
      movementSummaryRef,
      attentionSummaryRef,
      recorderRef,
      startRecording,
      stopRecording,
      resetRecording,
      sessionRef,
      start,
    ) => {
      calibrationSessionRef = sessionRef;
      startCalibration = start;
    };
    const { container, rerender } = render(
      <HookHarness stream={stream} onRender={onRender} trackingEnabled />,
    );
    const video = await findVideo(container);

    act(() => expect(startCalibration()).toBe(true));
    video.currentTime = 1;
    fireNextVideoFrame(video, 4100);
    expect(calibrationSessionRef.current.getSnapshot(4100)).toMatchObject({
      status: 'collecting',
      target: { label: 'CENTER' },
      acceptedSampleCount: 1,
    });
    expect(calibrationSessionRef.current.toJSON().screenCalibration.CENTER.acceptedSamples[0])
      .toMatchObject({
        timestampMs: 3100,
        headPitch: 0,
        eyeMeasurementReliability: 'reliable',
        eyeLookDownLeft: 0.77,
        eyeLookUpRight: 0.66,
      });

    rerender(<HookHarness stream={stream} onRender={onRender} trackingEnabled={false} />);
    expect(calibrationSessionRef.current.getSnapshot(4200).status).toBe('interrupted');
    video.currentTime = 2;
    fireNextVideoFrame(video, 4400);
    expect(calibrationSessionRef.current.getSnapshot(4400).collector.targets.CENTER)
      .toMatchObject({ acceptedSampleCount: 1 });
    expect(calibrationSessionRef.current.recordSample({
      faceDetected: true,
    }, 4300).accepted).toBe(false);

    rerender(<HookHarness stream={stream} onRender={onRender} trackingEnabled />);
    act(() => expect(startCalibration()).toBe(true));
    act(() => track.end());
    expect(calibrationSessionRef.current.getSnapshot(5000).status).toBe('interrupted');
  });

  it('starts the guided session in a non-recording transition state', async () => {
    const { stream } = createStream();
    let calibrationSessionRef;
    let startGuidedCalibration;
    const onRender = (...args) => {
      calibrationSessionRef = args[12];
      startGuidedCalibration = args[19];
    };
    const { container } = render(<HookHarness stream={stream} onRender={onRender} trackingEnabled />);
    await findVideo(container);

    act(() => expect(startGuidedCalibration()).toBe(true));
    const session = calibrationSessionRef.current;
    const timestamp = performance.now();
    expect(session.getSnapshot(timestamp)).toMatchObject({
      status: 'guided-transition',
      target: { label: 'CENTER' },
    });
    expect(session.recordSample({
      faceDetected: true,
    }, timestamp + 1).accepted).toBe(false);
    expect(session.beginGuidedCollection(timestamp + 2)).toBe(true);
    expect(session.getSnapshot(timestamp + 2).status).toBe('collecting');
  });

  it('records the real raw classifier reason and missing calibration requirements', async () => {
    const { stream } = createStream();
    let recorderRef;
    let startDiagnostic;
    let setStage;
    const onRender = (...args) => {
      recorderRef = args[20];
      startDiagnostic = args[21];
      setStage = args[22];
    };
    const { container } = render(<HookHarness stream={stream} onRender={onRender} trackingEnabled />);
    const video = await findVideo(container);

    act(() => {
      expect(startDiagnostic()).toBe(true);
      expect(setStage({
        id: 'CENTER_BEFORE',
        expectedLabel: 'CENTER',
        expectedState: 'LOOKING_AT_SCREEN',
      })).toBe(true);
    });
    video.currentTime = 2;
    fireNextVideoFrame(video, 1200);

    const snapshot = recorderRef.current.getSnapshot();
    expect(snapshot.samples).toHaveLength(1);
    expect(snapshot.samples[0]).toMatchObject({
      expectedStage: 'CENTER_BEFORE',
      modelReady: false,
      missingRequirements: expect.arrayContaining([
        'screen:CENTER:0/3',
        'away:LOOK_AWAY_LEFT:eyes:0/3',
      ]),
      rawClassifierState: 'UNKNOWN',
      smoothedState: 'UNKNOWN',
      smoothingDiagnostics: {
        state: 'UNKNOWN',
        transitionHoldMs: 500,
        unknownHoldMs: 500,
      },
      classifierReason: 'calibration-unavailable',
      liveFeatures: {
        faceDetected: false,
        headPoseValid: false,
        leftEyeValid: false,
        rightEyeValid: false,
        blendshapesValid: false,
      },
      classifierDiagnostics: {
        closestScreenProfile: null,
        closestOffscreenProfile: null,
      },
    });
  });

  it('preserves same-frame pose and blendshapes for unreliable gaze without extra inference', async () => {
    const { stream, track } = createStream();
    const neutralMatrix = {
      rows: 4,
      columns: 4,
      data: [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ],
    };
    const landmarks = createEyeLandmarks(0);
    landmarks[159] = { x: 0.35, y: 0.5, z: 0 };
    landmarks[145] = { x: 0.35, y: 0.5, z: 0 };
    mediapipeMocks.detectForVideo.mockReturnValue({
      faceLandmarks: [landmarks],
      facialTransformationMatrixes: [neutralMatrix],
      faceBlendshapes: [createEyeLookBlendshapes()],
    });
    let calibrationSessionRef;
    let startCalibration;
    const onRender = (
      status,
      error,
      poseRef,
      sampleRef,
      gazeRef,
      blendshapesRef,
      movementSummaryRef,
      attentionSummaryRef,
      recorderRef,
      startRecording,
      stopRecording,
      resetRecording,
      sessionRef,
      start,
    ) => {
      calibrationSessionRef = sessionRef;
      startCalibration = start;
    };
    const { container } = render(
      <HookHarness stream={stream} onRender={onRender} trackingEnabled />,
    );
    const video = await findVideo(container);

    act(() => expect(startCalibration()).toBe(true));
    video.currentTime = 1;
    fireNextVideoFrame(video, 4100);

    const report = calibrationSessionRef.current.toJSON();
    const center = report.screenCalibration.CENTER;
    expect(mediapipeMocks.detectForVideo).toHaveBeenCalledTimes(1);
    expect(center).toMatchObject({
      acceptedSampleCount: 0,
      rejectedSampleCount: 1,
      medians: { headYaw: null, headPitch: null },
    });
    expect(center.rejectedSamples[0]).toMatchObject({
      rejectionReason: 'eyes-closed-or-invalid',
      faceDetected: true,
      headPoseAvailable: true,
      headPoseValid: true,
      headPitch: 0,
      headYaw: expect.any(Number),
      leftEyeValid: true,
      rightEyeValid: false,
      leftEyeHorizontal: 0,
      rightEyeHorizontal: null,
      blendshapesValid: true,
      eyeMeasurementReliability: 'unreliable',
      eyeReliabilityReason: 'eyes-closed-or-invalid',
      originalRejectionReason: 'eyes-closed-or-invalid',
      eyeLookDownLeft: 0.77,
      eyeLookDownRight: 0.88,
    });
    expect(center.rejectedSamples[0].headYaw).toBeCloseTo(0);

    act(() => track.end());
  });

  it('stops recording on playback pause and camera track shutdown while retaining captured samples', async () => {
    const { stream, track } = createStream();
    mediapipeMocks.detectForVideo.mockReturnValue({
      faceLandmarks: [createEyeLandmarks(0)],
    });
    let recorderRef;
    let startRecording;
    const onRender = (
      status,
      error,
      poseRef,
      sampleRef,
      gazeRef,
      blendshapesRef,
      movementSummaryRef,
      attentionSummaryRef,
      nextRecorderRef,
      start,
    ) => {
      recorderRef = nextRecorderRef;
      startRecording = start;
    };
    const { container, rerender } = render(
      <HookHarness stream={stream} onRender={onRender} trackingEnabled />,
    );
    const video = await findVideo(container);
    act(() => startRecording());
    video.currentTime = 1;
    fireNextVideoFrame(video, 1000);
    expect(recorderRef.current.getSnapshot().totalSamples).toBe(1);

    rerender(<HookHarness stream={stream} onRender={onRender} trackingEnabled={false} />);
    expect(recorderRef.current.getSnapshot()).toMatchObject({
      recording: false,
      totalSamples: 1,
    });

    rerender(<HookHarness stream={stream} onRender={onRender} trackingEnabled />);
    act(() => startRecording());
    video.currentTime = 2;
    fireNextVideoFrame(video, 1200);
    act(() => track.end());
    expect(recorderRef.current.getSnapshot()).toMatchObject({
      recording: false,
      totalSamples: 1,
    });
  });

  it('enables and extracts the eight requested blendshape scores from the existing result', async () => {
    const { stream, track } = createStream();
    const expectedScores = {
      eyeLookInLeft: 0.11,
      eyeLookOutLeft: 0.22,
      eyeLookInRight: 0.33,
      eyeLookOutRight: 0.44,
      eyeLookUpLeft: 0.55,
      eyeLookUpRight: 0.66,
      eyeLookDownLeft: 0.77,
      eyeLookDownRight: 0.88,
    };
    mediapipeMocks.detectForVideo
      .mockReturnValueOnce({
        faceLandmarks: [createEyeLandmarks()],
        faceBlendshapes: [createEyeLookBlendshapes()],
      })
      .mockReturnValueOnce({
        faceLandmarks: [createEyeLandmarks()],
        faceBlendshapes: [{ categories: [{ categoryName: 'eyeLookInLeft', score: 0.21 }] }],
      })
      .mockReturnValueOnce({ faceLandmarks: [] });
    const renders = [];
    const onRender = (status, error, poseRef, sampleRef, gazeRef, blendshapesRef) => {
      renders.push({ status, error, poseRef, sampleRef, gazeRef, blendshapesRef });
    };
    const { container } = render(<HookHarness stream={stream} onRender={onRender} />);
    const video = await findVideo(container);

    video.currentTime = 1;
    fireNextVideoFrame(video, 1000);
    await waitFor(() => expect(renders.at(-1).status).toBe('detected'));
    expect(renders.at(-1).blendshapesRef.current).toEqual(expectedScores);

    video.currentTime = 2;
    fireNextVideoFrame(video, 1200);
    expect(renders.at(-1).blendshapesRef.current).toEqual({
      eyeLookInLeft: 0.21,
      eyeLookOutLeft: null,
      eyeLookInRight: null,
      eyeLookOutRight: null,
      eyeLookUpLeft: null,
      eyeLookUpRight: null,
      eyeLookDownLeft: null,
      eyeLookDownRight: null,
    });

    video.currentTime = 3;
    fireNextVideoFrame(video, 1400);
    await waitFor(() => expect(renders.at(-1).status).toBe('no-face'));
    expect(renders.at(-1).blendshapesRef.current).toBeNull();

    act(() => track.end());
    expect(renders.at(-1).blendshapesRef.current).toBeNull();
  });

  it('reports detection errors and closes the task without scheduling another frame', async () => {
    const detectionError = new Error('inference failed');
    mediapipeMocks.detectForVideo.mockImplementation(() => {
      throw detectionError;
    });
    const { stream } = createStream();
    const statuses = [];
    const { container } = render(
      <HookHarness stream={stream} onRender={(status) => statuses.push(status)} />,
    );
    const video = await findVideo(container);

    fireNextVideoFrame(video, 1000);

    await waitFor(() => expect(statuses.at(-1)).toBe('error'));
    expect(mediapipeMocks.close).toHaveBeenCalledTimes(1);
    expect(video.frameCallbacks.size).toBe(0);
    expect(console.error).toHaveBeenCalledWith(
      'Face Landmarker video detection failed:',
      detectionError,
    );
  });

  it('uses a timer fallback when video frame callbacks are unsupported', async () => {
    const { stream } = createStream();
    let fallbackCallback;
    const nativeSetTimeout = window.setTimeout.bind(window);
    vi.spyOn(window, 'setTimeout').mockImplementation((callback, delay, ...args) => {
      if (delay === 200) {
        fallbackCallback = callback;
        return 200;
      }
      return nativeSetTimeout(callback, delay, ...args);
    });
    const { container } = render(<HookHarness stream={stream} supportsVideoFrameCallbacks={false} />);
    await findVideo(container);

    expect(fallbackCallback).toBeTypeOf('function');
    act(() => fallbackCallback());
    expect(mediapipeMocks.detectForVideo).toHaveBeenCalledTimes(1);
  });

  it('pauses detection while the page is hidden and resumes when visible', async () => {
    const { stream } = createStream();
    const { container } = render(<HookHarness stream={stream} />);
    const video = await findVideo(container);

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(video.cancelVideoFrameCallback).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(video.frameCallbacks.size).toBe(1);
  });

  it('stops detection and closes MediaPipe when the camera track ends', async () => {
    const { stream, track } = createStream();
    const { container } = render(<HookHarness stream={stream} />);
    const video = await findVideo(container);

    act(() => track.end());

    expect(video.cancelVideoFrameCallback).toHaveBeenCalledTimes(1);
    expect(mediapipeMocks.close).toHaveBeenCalledTimes(1);
    expect(video.frameCallbacks.size).toBe(0);
  });

  it('cancels the frame loop and closes MediaPipe on unmount', async () => {
    const { stream } = createStream();
    const { container, unmount } = render(<HookHarness stream={stream} />);
    const video = await findVideo(container);

    unmount();

    expect(video.cancelVideoFrameCallback).toHaveBeenCalledTimes(1);
    expect(mediapipeMocks.close).toHaveBeenCalledTimes(1);
  });

  it('closes a landmarker that finishes initializing after unmount', async () => {
    const deferredLandmarker = createDeferred();
    mediapipeMocks.createFromOptions.mockReturnValue(deferredLandmarker.promise);
    const { stream } = createStream();
    const { container, unmount } = render(<HookHarness stream={stream} />);
    await waitFor(() => expect(mediapipeMocks.createFromOptions).toHaveBeenCalledTimes(1));

    unmount();
    deferredLandmarker.resolve({ close: mediapipeMocks.close, detectForVideo: vi.fn() });
    await deferredLandmarker.promise;
    await waitFor(() => expect(mediapipeMocks.close).toHaveBeenCalledTimes(1));
  });

  it('returns initialization errors without starting detection', async () => {
    const initializationError = new Error('model load failed');
    mediapipeMocks.forVisionTasks.mockRejectedValue(initializationError);
    const { stream } = createStream();
    let latestError = null;
    const onRender = (_status, error) => {
      latestError = error;
    };
    const { container } = render(<HookHarness stream={stream} onRender={onRender} />);

    await waitFor(() => expect(latestError).toBe(initializationError));
    expect(mediapipeMocks.createFromOptions).not.toHaveBeenCalled();
    expect(mediapipeMocks.detectForVideo).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      'Face Landmarker initialization failed:',
      initializationError,
    );
  });

  it('does not initialize a landmarker without an active stream', () => {
    render(<HookHarness stream={null} />);

    expect(mediapipeMocks.forVisionTasks).not.toHaveBeenCalled();
    expect(mediapipeMocks.createFromOptions).not.toHaveBeenCalled();
  });
});
