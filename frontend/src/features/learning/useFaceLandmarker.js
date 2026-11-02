import { useCallback, useEffect, useRef, useState } from 'react';
import { estimateHeadPose } from './headPoseEstimator.js';
import { estimateEyeGaze } from './eyeGazeEstimator.js';
import { createEyeMovementTracker } from './eyeMovementTracker.js';
import { estimateScreenAttention } from './screenAttentionEstimator.js';
import { createScreenAttentionTracker } from './screenAttentionTracker.js';
import {
  RECORDING_DURATION_MS,
  createScreenAttentionDiagnosticRecorder,
} from './screenAttentionDiagnosticRecorder.js';
import { createScreenCalibrationSession } from './screenCalibrationCollector.js';

const MODEL_PATH = '/models/face_landmarker.task';
const WASM_PATH = '/mediapipe/wasm';
const DETECTION_INTERVAL_MS = 200;
const EYE_LOOK_BLENDSHAPES = [
  'eyeLookInLeft',
  'eyeLookOutLeft',
  'eyeLookInRight',
  'eyeLookOutRight',
  'eyeLookUpLeft',
  'eyeLookUpRight',
  'eyeLookDownLeft',
  'eyeLookDownRight',
];

function extractEyeLookBlendshapes(results) {
  const categories = results.faceBlendshapes?.[0]?.categories;
  if (!Array.isArray(categories) || categories.length === 0) return null;

  const scores = Object.fromEntries(EYE_LOOK_BLENDSHAPES.map((name) => [name, null]));
  categories.forEach(({ categoryName, score }) => {
    if (
      Object.prototype.hasOwnProperty.call(scores, categoryName)
      && Number.isFinite(score)
    ) {
      scores[categoryName] = score;
    }
  });
  return scores;
}

function toError(error) {
  if (error instanceof Error) return error;
  return new Error('Face Landmarker could not process the camera video.');
}

export default function useFaceLandmarker(videoRef, stream, onResults, trackingEnabled = false) {
  const [status, setStatus] = useState('off');
  const [error, setError] = useState(null);
  const onResultsRef = useRef(onResults);
  const trackingEnabledRef = useRef(trackingEnabled);
  const latestPoseRef = useRef(null);
  const latestEyeGazeRef = useRef(null);
  const latestEyeLookBlendshapesRef = useRef(null);
  const eyeMovementTrackerRef = useRef(null);
  const latestEyeMovementSummaryRef = useRef(null);
  const screenAttentionTrackerRef = useRef(null);
  const latestScreenAttentionSummaryRef = useRef(null);
  const screenAttentionRecorderRef = useRef(null);
  const screenCalibrationSessionRef = useRef(null);
  const recordingTimeoutRef = useRef(null);
  const latestDetectionSampleRef = useRef(null);
  if (!eyeMovementTrackerRef.current) {
    eyeMovementTrackerRef.current = createEyeMovementTracker();
  }
  if (!screenAttentionTrackerRef.current) {
    screenAttentionTrackerRef.current = createScreenAttentionTracker();
  }
  if (!screenAttentionRecorderRef.current) {
    screenAttentionRecorderRef.current = createScreenAttentionDiagnosticRecorder();
  }
  if (!screenCalibrationSessionRef.current) {
    screenCalibrationSessionRef.current = createScreenCalibrationSession();
  }
  onResultsRef.current = onResults;
  trackingEnabledRef.current = trackingEnabled;

  const stopDiagnosticRecording = useCallback(() => {
    if (recordingTimeoutRef.current !== null) {
      window.clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    screenAttentionRecorderRef.current.stop(performance.now());
  }, []);

  const startDiagnosticRecording = useCallback(() => {
    if (!trackingEnabledRef.current) return false;
    screenAttentionTrackerRef.current.reset();
    latestScreenAttentionSummaryRef.current = null;
    screenAttentionRecorderRef.current.start(performance.now());
    if (recordingTimeoutRef.current !== null) {
      window.clearTimeout(recordingTimeoutRef.current);
    }
    recordingTimeoutRef.current = window.setTimeout(
      stopDiagnosticRecording,
      RECORDING_DURATION_MS,
    );
    return true;
  }, [stopDiagnosticRecording]);

  const resetDiagnosticRecording = useCallback(() => {
    if (recordingTimeoutRef.current !== null) {
      window.clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    screenAttentionRecorderRef.current.reset();
    screenAttentionTrackerRef.current.reset();
    latestScreenAttentionSummaryRef.current = null;
  }, []);

  const startCalibration = useCallback(() => {
    if (!trackingEnabledRef.current) return false;
    screenCalibrationSessionRef.current.start(performance.now());
    return true;
  }, []);

  const cancelCalibration = useCallback(() => {
    screenCalibrationSessionRef.current.cancel();
  }, []);

  const restartCalibration = useCallback(() => startCalibration(), [startCalibration]);

  const repeatCalibrationTarget = useCallback(() => {
    if (!trackingEnabledRef.current) return false;
    return screenCalibrationSessionRef.current.repeatTarget(performance.now());
  }, []);

  const startKeyboardEvaluation = useCallback(() => {
    if (!trackingEnabledRef.current) return false;
    return screenCalibrationSessionRef.current.startKeyboardEvaluation(performance.now());
  }, []);

  const completeCalibration = useCallback(() => {
    screenCalibrationSessionRef.current.completeWithoutKeyboard();
  }, []);

  useEffect(() => {
    eyeMovementTrackerRef.current.reset();
    latestEyeMovementSummaryRef.current = null;
    screenAttentionTrackerRef.current.reset();
    latestScreenAttentionSummaryRef.current = null;
    if (!trackingEnabled) {
      stopDiagnosticRecording();
      screenCalibrationSessionRef.current.interrupt();
    }
  }, [trackingEnabled, stopDiagnosticRecording]);

  useEffect(() => {
    const video = videoRef.current;
    if (!stream || !video) {
      latestPoseRef.current = null;
      latestEyeGazeRef.current = null;
      latestEyeLookBlendshapesRef.current = null;
      eyeMovementTrackerRef.current.reset();
      latestEyeMovementSummaryRef.current = null;
      screenAttentionTrackerRef.current.reset();
      latestScreenAttentionSummaryRef.current = null;
      latestDetectionSampleRef.current = null;
      setStatus((currentStatus) => (currentStatus === 'off' ? currentStatus : 'off'));
      setError((currentError) => (currentError ? null : currentError));
      return undefined;
    }

    setStatus((currentStatus) => (currentStatus === 'loading' ? currentStatus : 'loading'));
    let cancelled = false;
    let permanentlyStopped = false;
    let loopRunning = false;
    let taskClosed = false;
    let faceLandmarker = null;
    let videoFrameCallbackId = null;
    let timeoutId = null;
    let lastDetectionAt = Number.NEGATIVE_INFINITY;
    let lastMediaTime = Number.NEGATIVE_INFINITY;
    let lastTimestamp = Number.NEGATIVE_INFINITY;

    const videoTracks = stream.getVideoTracks();
    const isTrackActive = () => videoTracks.some((track) => track.readyState !== 'ended');

    function closeTask() {
      if (!faceLandmarker || taskClosed) return;
      taskClosed = true;
      faceLandmarker.close();
      faceLandmarker = null;
    }

    function cancelScheduledFrame() {
      if (videoFrameCallbackId !== null) {
        video.cancelVideoFrameCallback(videoFrameCallbackId);
        videoFrameCallbackId = null;
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
    }

    function stopLoop() {
      loopRunning = false;
      stopDiagnosticRecording();
      screenCalibrationSessionRef.current.interrupt();
      latestEyeGazeRef.current = null;
      latestEyeLookBlendshapesRef.current = null;
      eyeMovementTrackerRef.current.reset();
      latestEyeMovementSummaryRef.current = null;
      screenAttentionTrackerRef.current.reset();
      latestScreenAttentionSummaryRef.current = null;
      cancelScheduledFrame();
    }

    function stopPermanently() {
      permanentlyStopped = true;
      stopLoop();
      closeTask();
    }

    function videoHasFrame() {
      return (
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
        && video.videoWidth > 0
        && video.videoHeight > 0
        && !video.paused
      );
    }

    function detectFrame(frameTimestamp) {
      if (!loopRunning || cancelled || permanentlyStopped) return;
      if (!isTrackActive()) {
        stopPermanently();
        return;
      }

      const now = frameTimestamp ?? performance.now();
      const hasNewVideoFrame = video.currentTime !== lastMediaTime;
      if (
        videoHasFrame()
        && hasNewVideoFrame
        && now - lastDetectionAt >= DETECTION_INTERVAL_MS
      ) {
        const timestamp = Math.max(now, lastTimestamp + 1);
        try {
          const result = faceLandmarker.detectForVideo(video, timestamp);
          lastDetectionAt = now;
          lastMediaTime = video.currentTime;
          lastTimestamp = timestamp;
          onResultsRef.current?.(result);
          const matrix = result.facialTransformationMatrixes?.[0];
          const hasFace = Boolean(result.faceLandmarks?.length);
          latestPoseRef.current = hasFace && matrix
            ? estimateHeadPose(matrix)
            : null;
          latestEyeGazeRef.current = hasFace
            ? estimateEyeGaze(result.faceLandmarks[0])
            : estimateEyeGaze(null);
          const eyeLookBlendshapes = hasFace
            ? extractEyeLookBlendshapes(result)
            : null;
          if (trackingEnabledRef.current) {
            screenCalibrationSessionRef.current.recordSample({
              faceDetected: hasFace,
              headPose: latestPoseRef.current,
              eyeGaze: latestEyeGazeRef.current,
              blendshapes: eyeLookBlendshapes,
            }, now);
          }
          if (trackingEnabledRef.current) {
            latestEyeMovementSummaryRef.current = eyeMovementTrackerRef.current.addSample(
              latestEyeGazeRef.current,
              now,
            );
            const attentionEstimate = estimateScreenAttention(
              latestPoseRef.current,
              latestEyeGazeRef.current,
            );
            latestScreenAttentionSummaryRef.current = screenAttentionTrackerRef.current.addSample(
              attentionEstimate,
              now,
            );
            if (screenAttentionRecorderRef.current.getSnapshot().recording) {
              screenAttentionRecorderRef.current.record({
                headYaw: Number.isFinite(latestPoseRef.current?.yaw)
                  ? latestPoseRef.current.yaw
                  : null,
                headPitch: Number.isFinite(latestPoseRef.current?.pitch)
                  ? latestPoseRef.current.pitch
                  : null,
                leftEyeHorizontal: Number.isFinite(latestEyeGazeRef.current?.leftEye?.horizontal)
                  ? latestEyeGazeRef.current.leftEye.horizontal
                  : null,
                leftEyeVertical: Number.isFinite(latestEyeGazeRef.current?.leftEye?.vertical)
                  ? latestEyeGazeRef.current.leftEye.vertical
                  : null,
                rightEyeHorizontal: Number.isFinite(latestEyeGazeRef.current?.rightEye?.horizontal)
                  ? latestEyeGazeRef.current.rightEye.horizontal
                  : null,
                rightEyeVertical: Number.isFinite(latestEyeGazeRef.current?.rightEye?.vertical)
                  ? latestEyeGazeRef.current.rightEye.vertical
                  : null,
                eyeMeasurementReliability: latestEyeGazeRef.current?.reliability || 'unreliable',
                eyeReliabilityReason: latestEyeGazeRef.current?.reason || 'Reason unavailable',
                combinedYaw: Number.isFinite(attentionEstimate.combinedYaw)
                  ? attentionEstimate.combinedYaw
                  : null,
                combinedPitch: Number.isFinite(attentionEstimate.combinedPitch)
                  ? attentionEstimate.combinedPitch
                  : null,
                screenAttentionState: attentionEstimate.state,
                screenAttentionReason: attentionEstimate.reason || 'Reason unavailable',
                smoothedScreenAttentionState: latestScreenAttentionSummaryRef.current.currentState,
                eyeLookDownLeft: Number.isFinite(eyeLookBlendshapes?.eyeLookDownLeft)
                  ? eyeLookBlendshapes.eyeLookDownLeft
                  : null,
                eyeLookDownRight: Number.isFinite(eyeLookBlendshapes?.eyeLookDownRight)
                  ? eyeLookBlendshapes.eyeLookDownRight
                  : null,
              }, now);
            }
          }
          latestEyeLookBlendshapesRef.current = eyeLookBlendshapes;
          const matrixData = matrix?.data;
          const hasMatrixData = Array.isArray(matrixData) || ArrayBuffer.isView(matrixData);
          latestDetectionSampleRef.current = hasFace && matrix && hasMatrixData
            ? {
              matrix: {
                rows: matrix.rows,
                columns: matrix.columns,
                data: Array.from(matrixData),
              },
              pose: latestPoseRef.current,
            }
            : null;
          const nextStatus = hasFace ? 'detected' : 'no-face';
          setStatus((currentStatus) => (
            currentStatus === nextStatus ? currentStatus : nextStatus
          ));
        } catch (detectionError) {
          if (!cancelled) {
            const normalizedError = toError(detectionError);
            latestPoseRef.current = null;
            latestEyeGazeRef.current = null;
            latestEyeLookBlendshapesRef.current = null;
            eyeMovementTrackerRef.current.reset();
            latestEyeMovementSummaryRef.current = null;
            screenAttentionTrackerRef.current.reset();
            latestScreenAttentionSummaryRef.current = null;
            latestDetectionSampleRef.current = null;
            setError(normalizedError);
            setStatus('error');
            console.error('Face Landmarker video detection failed:', normalizedError);
          }
          stopPermanently();
          return;
        }
      }

      scheduleFrame();
    }

    function scheduleFrame() {
      if (!loopRunning || cancelled || permanentlyStopped) return;
      if (
        typeof video.requestVideoFrameCallback === 'function'
        && typeof video.cancelVideoFrameCallback === 'function'
      ) {
        videoFrameCallbackId = video.requestVideoFrameCallback((now) => {
          videoFrameCallbackId = null;
          detectFrame(now);
        });
      } else {
        timeoutId = window.setTimeout(() => {
          timeoutId = null;
          detectFrame();
        }, DETECTION_INTERVAL_MS);
      }
    }

    function startLoop() {
      if (
        loopRunning
        || cancelled
        || permanentlyStopped
        || !faceLandmarker
        || document.visibilityState === 'hidden'
      ) {
        return;
      }
      loopRunning = true;
      scheduleFrame();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        stopLoop();
      } else {
        startLoop();
      }
    }

    function handleTrackEnded() {
      stopPermanently();
      latestPoseRef.current = null;
      latestEyeGazeRef.current = null;
      latestEyeLookBlendshapesRef.current = null;
      eyeMovementTrackerRef.current.reset();
      latestEyeMovementSummaryRef.current = null;
      screenAttentionTrackerRef.current.reset();
      latestScreenAttentionSummaryRef.current = null;
      latestDetectionSampleRef.current = null;
      setStatus('off');
    }

    setError((currentError) => (currentError ? null : currentError));
    document.addEventListener('visibilitychange', handleVisibilityChange);
    videoTracks.forEach((track) => track.addEventListener('ended', handleTrackEnded));

    async function initialize() {
      try {
        const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
        if (cancelled || permanentlyStopped) return;

        const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
        if (cancelled || permanentlyStopped) return;

        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_PATH },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFacialTransformationMatrixes: true,
          outputFaceBlendshapes: true,
        });

        if (cancelled || permanentlyStopped) {
          landmarker.close();
          return;
        }

        faceLandmarker = landmarker;
        setStatus('ready');
        startLoop();
      } catch (initializationError) {
        if (!cancelled && !permanentlyStopped) {
          const normalizedError = toError(initializationError);
          latestPoseRef.current = null;
          latestEyeGazeRef.current = null;
          latestEyeLookBlendshapesRef.current = null;
          eyeMovementTrackerRef.current.reset();
          latestEyeMovementSummaryRef.current = null;
          screenAttentionTrackerRef.current.reset();
          latestScreenAttentionSummaryRef.current = null;
          latestDetectionSampleRef.current = null;
          setError(normalizedError);
          setStatus('error');
          console.error('Face Landmarker initialization failed:', normalizedError);
          stopPermanently();
        }
      }
    }

    if (isTrackActive()) {
      initialize();
    } else {
      stopPermanently();
    }

    return () => {
      cancelled = true;
      latestPoseRef.current = null;
      latestEyeGazeRef.current = null;
      latestEyeLookBlendshapesRef.current = null;
      eyeMovementTrackerRef.current.reset();
      latestEyeMovementSummaryRef.current = null;
      screenAttentionTrackerRef.current.reset();
      latestScreenAttentionSummaryRef.current = null;
      latestDetectionSampleRef.current = null;
      stopLoop();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      videoTracks.forEach((track) => track.removeEventListener('ended', handleTrackEnded));
      closeTask();
    };
  }, [stream, videoRef]);

  return {
    status,
    error,
    latestPoseRef,
    latestEyeGazeRef,
    latestEyeLookBlendshapesRef,
    latestEyeMovementSummaryRef,
    latestScreenAttentionSummaryRef,
    screenAttentionRecorderRef,
    screenCalibrationSessionRef,
    startDiagnosticRecording,
    stopDiagnosticRecording,
    resetDiagnosticRecording,
    startCalibration,
    cancelCalibration,
    restartCalibration,
    repeatCalibrationTarget,
    startKeyboardEvaluation,
    completeCalibration,
    latestDetectionSampleRef,
  };
}
