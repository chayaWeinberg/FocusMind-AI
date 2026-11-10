import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WebGazerExperimentPage from './WebGazerExperimentPage.jsx';

const webGazerMocks = vi.hoisted(() => {
  const regressionData = [];
  const regression = { getData: vi.fn(() => regressionData) };
  const api = {
    params: {},
    begin: vi.fn().mockResolvedValue(undefined),
    clearGazeListener: vi.fn(),
    end: vi.fn(),
    getCurrentPrediction: vi.fn().mockResolvedValue({ eyeFeatures: { left: {}, right: {} } }),
    getRegression: vi.fn(() => [regression]),
    isReady: vi.fn(() => true),
    recordScreenPosition: vi.fn(() => regressionData.push({ sample: true })),
    removeMouseEventListeners: vi.fn(),
    saveDataAcrossSessions: vi.fn(),
    setGazeListener: vi.fn(),
    showFaceFeedbackBox: vi.fn(),
    showFaceOverlay: vi.fn(),
    showPredictionPoints: vi.fn(),
    showVideo: vi.fn(),
    showVideoPreview: vi.fn(),
    stopVideo: vi.fn(),
  };
  return { api, regressionData, regression };
});

vi.mock('webgazer', () => ({ default: webGazerMocks.api }));

let gazeListener;
let utterances;
let speechSynthesis;

class MockUtterance {
  constructor(text) {
    this.text = text;
  }
}

function installSpeechMocks({ voices = [{ lang: 'he-IL' }] } = {}) {
  utterances = [];
  speechSynthesis = {
    cancel: vi.fn(),
    getVoices: vi.fn(() => voices),
    speak: vi.fn((utterance) => utterances.push(utterance)),
  };
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: speechSynthesis,
  });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    configurable: true,
    value: MockUtterance,
  });
}

async function startCamera() {
  fireEvent.click(screen.getByRole('button', { name: 'הפעלת מצלמה והתחלת WebGazer' }));
  await waitFor(() => expect(webGazerMocks.api.begin).toHaveBeenCalledOnce());
  await screen.findByRole('button', { name: 'התחלת כיול קולי' });
}

async function finishCalibration() {
  fireEvent.click(screen.getByRole('button', { name: 'התחלת כיול קולי' }));
  const labels = ['מרכז', 'למעלה', 'למטה', 'שמאלה', 'ימינה'];
  for (const label of labels) {
    const utterance = utterances.at(-1);
    act(() => utterance.onend());
    act(() => vi.advanceTimersByTime(500));
    for (let click = 0; click < 3; click += 1) {
      await act(async () => {
        fireEvent.click(screen.getByRole('button', {
          name: new RegExp(`נקודת כיול ${label}`),
        }));
        await Promise.resolve();
        await Promise.resolve();
      });
    }
  }
  expect(screen.getByText(/הכיול הושלם בחמש נקודות/)).toBeInTheDocument();
}

describe('isolated WebGazer experiment page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    webGazerMocks.regressionData.length = 0;
    webGazerMocks.api.params = {};
    webGazerMocks.api.begin.mockResolvedValue(undefined);
    webGazerMocks.api.isReady.mockReturnValue(true);
    gazeListener = null;
    webGazerMocks.api.setGazeListener.mockImplementation((listener) => {
      gazeListener = listener;
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    });
    installSpeechMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('does not request camera access until the user explicitly starts WebGazer', async () => {
    render(<WebGazerExperimentPage />);

    expect(screen.getByText('המצלמה כבויה')).toBeInTheDocument();
    expect(webGazerMocks.api.begin).not.toHaveBeenCalled();
    await startCamera();

    expect(webGazerMocks.api.saveDataAcrossSessions).toHaveBeenCalledWith(false);
    expect(webGazerMocks.api.params.saveDataAcrossSessions).toBe(false);
    expect(webGazerMocks.api.params.faceMeshSolutionPath).toBe('/mediapipe/webgazer-face-mesh');
    expect(webGazerMocks.api.removeMouseEventListeners).toHaveBeenCalledOnce();
  });

  it('calibrates five visible targets with three explicit gaze samples each', async () => {
    render(<WebGazerExperimentPage />);
    await startCamera();
    vi.useFakeTimers();
    await finishCalibration();

    expect(webGazerMocks.api.getCurrentPrediction).toHaveBeenCalledTimes(15);
    expect(webGazerMocks.api.recordScreenPosition).toHaveBeenCalledTimes(15);
    expect(webGazerMocks.api.recordScreenPosition).toHaveBeenNthCalledWith(
      1,
      expect.any(Number),
      expect.any(Number),
      'click',
    );
    expect(screen.getByRole('button', { name: 'התחלת ארבעת התנאים' })).toBeInTheDocument();
  });

  it('waits for spoken instructions and the settling delay, records four conditions, and exports JSON', async () => {
    const createObjectURL = vi.fn(() => 'blob:webgazer-report');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    const downloadClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<WebGazerExperimentPage />);
    await startCamera();
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date', 'performance'] });
    vi.setSystemTime(new Date(0));
    await finishCalibration();

    act(() => {
      for (let index = 0; index < 8; index += 1) gazeListener({ x: 500, y: 400 });
    });
    fireEvent.click(screen.getByRole('button', { name: 'התחלת ארבעת התנאים' }));
    expect(utterances.at(-1).text).toBe('הביטי במרכז המסך והשאירי את הראש יציב.');
    expect(screen.getByText(/אין איסוף/)).toBeInTheDocument();

    const expected = [
      'A — מסך, ראש יציב',
      'B — מחוץ למסך, עיניים בלבד',
      'C — מסך לאחר תנועה טבעית',
      'D — מחוץ למסך עם סיבוב ראש',
    ];
    for (let index = 0; index < expected.length; index += 1) {
      act(() => utterances.at(-1).onend());
      act(() => vi.advanceTimersByTime(1499));
      expect(screen.getByText(/המתנה לסיום התנועה — אין איסוף/)).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(1));
      expect(screen.getByText(/אוספים תחזיות WebGazer/)).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(5000));
      if (index < expected.length - 1) {
        expect(utterances.at(-1).text).toBe(TEST_INSTRUCTIONS[index]);
      }
    }

    expect(screen.getByText(/הבדיקה הושלמה/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'הורדת תוצאות הניסוי (JSON)' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'הורדת תוצאות הניסוי (JSON)' }));
    expect(downloadClick.mock.contexts[0].download).toBe('webgazer-gaze-experiment.json');

    const exportedText = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(createObjectURL.mock.calls[0][0]);
    });
    const exported = JSON.parse(exportedText);
    expect(exported.stageSummaries.map((stage) => stage.expectedCondition)).toEqual(expected);
    expect(exported.samples[0]).toMatchObject({
      expectedCondition: expected[0],
      expectedState: 'LOOKING_AT_SCREEN',
      gazeCoordinates: { x: 500, y: 400 },
      screenBounds: { width: window.innerWidth, height: window.innerHeight },
      predictedState: 'LOOKING_AT_SCREEN',
      estimationAvailable: true,
      headPose: { available: false, yaw: null, pitch: null, roll: null },
    });
    expect(exported.samples[0]).not.toHaveProperty('eyeFeatures');
    expect(exported).toMatchObject({
      limitations: {
        outOfBoundsIsNotProofOfLookingAway: true,
        confidenceAvailable: false,
      },
    });
  });

  it('stops WebGazer and its camera when the experiment component unmounts', async () => {
    const { unmount } = render(<WebGazerExperimentPage />);
    await startCamera();
    unmount();

    expect(webGazerMocks.api.clearGazeListener).toHaveBeenCalledOnce();
    expect(webGazerMocks.api.removeMouseEventListeners).toHaveBeenCalled();
    expect(webGazerMocks.api.end).toHaveBeenCalledOnce();
    expect(webGazerMocks.api.stopVideo).toHaveBeenCalledOnce();
  });

  it('cleans up a camera whose permission/startup promise resolves after unmount', async () => {
    let resolveBegin;
    webGazerMocks.api.begin.mockImplementation(() => new Promise((resolve) => {
      resolveBegin = resolve;
    }));
    webGazerMocks.api.isReady.mockReturnValue(false);
    const { unmount } = render(<WebGazerExperimentPage />);
    fireEvent.click(screen.getByRole('button', { name: 'הפעלת מצלמה והתחלת WebGazer' }));
    await waitFor(() => expect(webGazerMocks.api.begin).toHaveBeenCalledOnce());

    unmount();
    expect(webGazerMocks.api.end).not.toHaveBeenCalled();
    webGazerMocks.api.isReady.mockReturnValue(true);
    await act(async () => {
      resolveBegin();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(webGazerMocks.api.end).toHaveBeenCalledOnce();
    expect(webGazerMocks.api.stopVideo).toHaveBeenCalledOnce();
  });
});

const TEST_INSTRUCTIONS = [
  'הביטי מחוץ למסך בעזרת העיניים בלבד, והשאירי את הראש במקומו.',
  'הביטי שוב במרכז המסך והזיזי מעט את הראש או הגוף באופן טבעי.',
  'הביטי מחוץ למסך וסובבי מעט את הראש לכיוון המבט.',
];
