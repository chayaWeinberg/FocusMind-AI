import { useState } from 'react';
import ConfirmButton from '../../components/ConfirmButton.jsx';
import useLoader from '../courses/useLoader.js';
import { addQuestion, deleteQuestion, getLessonQuiz, submitQuiz } from '../learning/learningApi.js';
import './Quiz.css';

const LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];

function QuestionForm({ lessonId, canShare, onCreated }) {
  const [prompt, setPrompt] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [correct, setCorrect] = useState(0);
  const [explanation, setExplanation] = useState('');
  const [state, setState] = useState({ busy: false, error: '' });

  function validate() {
    if (prompt.trim().length < 3) return 'כתבו שאלה באורך 3 תווים לפחות.';
    const cleaned = options.map((option) => option.trim());
    if (cleaned.some((option) => !option)) return 'מלאו את כל התשובות, או הסירו תשובה ריקה.';
    if (new Set(cleaned.map((option) => option.toLowerCase())).size !== cleaned.length) return 'התשובות צריכות להיות שונות זו מזו.';
    return '';
  }

  async function submit(event) {
    event.preventDefault();
    const error = validate();
    if (error) {
      setState({ busy: false, error });
      return;
    }
    setState({ busy: true, error: '' });
    try {
      const created = await addQuestion(lessonId, {
        prompt: prompt.trim(),
        options: options.map((option) => option.trim()),
        correctIndex: correct,
        explanation: explanation.trim(),
      });
      setPrompt('');
      setOptions(['', '']);
      setCorrect(0);
      setExplanation('');
      setState({ busy: false, error: '' });
      onCreated(created);
    } catch (apiError) {
      setState({ busy: false, error: apiError.message });
    }
  }

  return (
    <form className="quiz-form" onSubmit={submit} noValidate aria-label="הוספת שאלת חזרה">
      <label className="quiz-form-wide">
        <span>השאלה</span>
        <input value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={300} />
      </label>
      <fieldset className="quiz-form-wide">
        <legend>תשובות (סמנו את התשובה הנכונה)</legend>
        {options.map((option, index) => (
          <div key={index} className="quiz-option-input">
            <input
              type="radio"
              name="quiz-correct"
              checked={correct === index}
              onChange={() => setCorrect(index)}
              aria-label={`תשובה ${LETTERS[index]} היא הנכונה`}
            />
            <input
              value={option}
              maxLength={200}
              aria-label={`תשובה ${LETTERS[index]}`}
              onChange={(event) => setOptions((previous) => previous.map((value, position) => (position === index ? event.target.value : value)))}
            />
            {options.length > 2 && (
              <button
                type="button"
                className="lesson-inline-button"
                aria-label={`הסרת תשובה ${LETTERS[index]}`}
                onClick={() => {
                  setOptions((previous) => previous.filter((_, position) => position !== index));
                  setCorrect((previous) => (previous === index ? 0 : previous > index ? previous - 1 : previous));
                }}
              >
                הסרה
              </button>
            )}
          </div>
        ))}
        {options.length < 6 && (
          <button type="button" className="lesson-inline-button" onClick={() => setOptions((previous) => [...previous, ''])}>
            + הוספת תשובה
          </button>
        )}
      </fieldset>
      <label className="quiz-form-wide">
        <span>הסבר שיוצג אחרי המענה (לא חובה)</span>
        <input value={explanation} onChange={(event) => setExplanation(event.target.value)} maxLength={500} />
      </label>
      <div className="course-form-actions">
        <button type="submit" className="signature-primary-button" disabled={state.busy}>{state.busy ? 'שומרים…' : 'שמירת השאלה'}</button>
        <small>{canShare ? 'כמנהלי תוכן, השאלה תוצג לכל הלומדים בשיעור.' : 'השאלה פרטית ונראית רק לכם.'}</small>
      </div>
      {state.error && <p className="course-inline-error" role="alert">{state.error}</p>}
    </form>
  );
}

function Results({ attempt, onRetry, onlyWrong = false }) {
  const results = onlyWrong ? attempt.results.filter((result) => !result.correct) : attempt.results;
  return (
    <div className="quiz-results">
      <p className="quiz-score" role="status">
        ענית נכון על <b>{attempt.score}</b> מתוך <b>{attempt.total}</b> שאלות ({attempt.percent}%).
      </p>
      <ol>
        {results.map((result) => (
          <li key={result.questionId} className={result.correct ? 'is-correct' : 'is-wrong'}>
            <strong>{result.prompt}</strong>
            <span>
              <span aria-hidden="true">{result.correct ? '✓ ' : '✗ '}</span>
              {result.correct ? 'נכון' : 'לא נכון'}: בחרת ״{result.options[result.choice]}״
            </span>
            {!result.correct && <span>התשובה הנכונה: ״{result.options[result.correctIndex]}״</span>}
            {result.explanation && <small>{result.explanation}</small>}
          </li>
        ))}
      </ol>
      {onRetry && <button type="button" className="signature-secondary-button" onClick={onRetry}>לענות שוב</button>}
    </div>
  );
}

/**
 * QuizFlow for one lesson: optional review questions. The quiz never blocks
 * lesson completion. Questions are written by hand: nothing is generated from
 * the video, because its content was never analyzed.
 */
export default function QuizPanel({ lessonId }) {
  const quiz = useLoader(() => getLessonQuiz(lessonId), [lessonId]);
  const [mode, setMode] = useState('overview'); // overview | answering | result | manage
  const [answers, setAnswers] = useState({});
  const [attempt, setAttempt] = useState(null);
  const [state, setState] = useState({ busy: false, error: '' });
  const data = quiz.data;
  const questions = data?.questions ?? [];

  async function submit(event) {
    event.preventDefault();
    const missing = questions.filter((question) => answers[question.id] === undefined).length;
    if (missing) {
      setState({ busy: false, error: `נשארו ${missing} שאלות בלי תשובה.` });
      return;
    }
    setState({ busy: true, error: '' });
    try {
      const result = await submitQuiz(lessonId, questions.map((question) => ({ questionId: question.id, choice: answers[question.id] })));
      setAttempt(result);
      setMode('result');
      setState({ busy: false, error: '' });
      quiz.setData({ ...data, attemptCount: data.attemptCount + 1, lastAttempt: result });
    } catch (error) {
      setState({ busy: false, error: error.message });
    }
  }

  async function removeQuestion(question) {
    try {
      await deleteQuestion(question.id);
      quiz.setData({ ...data, questions: questions.filter((item) => item.id !== question.id) });
    } catch (error) {
      setState({ busy: false, error: error.message });
    }
  }

  const last = data?.lastAttempt;
  const wrongInLast = last ? last.results.filter((result) => !result.correct).length : 0;

  return (
    <section className="quiz-panel" aria-labelledby="quiz-title">
      <div className="quiz-head">
        <h2 id="quiz-title">QuizFlow – שאלות חזרה</h2>
        {quiz.status === 'ready' && (
          <span>{questions.length ? `${questions.length} שאלות` : 'אין עדיין שאלות'}{data.attemptCount ? ` · ${data.attemptCount} ניסיונות` : ''}</span>
        )}
      </div>
      {quiz.status === 'loading' && <p className="course-state" role="status"><span className="route-loading-spinner" aria-hidden="true" /> טוענים שאלות…</p>}
      {quiz.status === 'error' && (
        <div className="course-state course-state--error" role="alert">
          <p>{quiz.error}</p>
          <button type="button" className="signature-secondary-button" onClick={() => quiz.reload()}>לנסות שוב</button>
        </div>
      )}
      {state.error && <p className="course-inline-error" role="alert">{state.error}</p>}

      {quiz.status === 'ready' && mode === 'overview' && (
        <div className="quiz-overview">
          <p>
            שאלות שאתם כותבים כדי לבדוק את עצמכם. הן לא חובה ולא משפיעות על השלמת השיעור.
            {last && ` בניסיון האחרון: ${last.percent}%.`}
          </p>
          <div className="quiz-actions">
            {questions.length > 0 && (
              <button type="button" className="signature-primary-button" onClick={() => { setAnswers({}); setMode('answering'); }}>
                מענה על השאלות
              </button>
            )}
            {wrongInLast > 0 && (
              <button type="button" className="signature-secondary-button" onClick={() => { setAttempt(last); setMode('wrong'); }}>
                חזרה על {wrongInLast} טעויות מהניסיון האחרון
              </button>
            )}
            {data.canAuthor && (
              <button type="button" className="signature-secondary-button" onClick={() => setMode('manage')}>
                {questions.length ? 'ניהול השאלות' : 'הוספת שאלה ראשונה'}
              </button>
            )}
          </div>
        </div>
      )}

      {mode === 'answering' && (
        <form className="quiz-answering" onSubmit={submit} aria-label="מענה על שאלות החזרה">
          <ol>
            {questions.map((question, number) => (
              <li key={question.id}>
                <fieldset>
                  <legend>{number + 1}. {question.prompt}</legend>
                  {question.options.map((option, index) => (
                    <label key={option}>
                      <input
                        type="radio"
                        name={`question-${question.id}`}
                        checked={answers[question.id] === index}
                        onChange={() => setAnswers((previous) => ({ ...previous, [question.id]: index }))}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </fieldset>
              </li>
            ))}
          </ol>
          <div className="quiz-actions">
            <button type="submit" className="signature-primary-button" disabled={state.busy}>{state.busy ? 'בודקים…' : 'בדיקת התשובות'}</button>
            <button type="button" className="signature-secondary-button" onClick={() => setMode('overview')}>ביטול</button>
          </div>
        </form>
      )}

      {(mode === 'result' || mode === 'wrong') && attempt && (
        <>
          <Results attempt={attempt} onlyWrong={mode === 'wrong'} onRetry={() => { setAnswers({}); setMode('answering'); }} />
          <button type="button" className="lesson-inline-button" onClick={() => setMode('overview')}>חזרה לשאלות החזרה</button>
        </>
      )}

      {mode === 'manage' && data && (
        <div className="quiz-manage">
          {questions.length > 0 && (
            <ol className="quiz-question-list">
              {questions.map((question) => (
                <li key={question.id}>
                  <strong>{question.prompt}</strong>
                  <small>
                    {question.shared ? 'שאלה משותפת לכל הלומדים' : 'שאלה פרטית'}
                    {question.mine && question.correctIndex !== null && <> · תשובה נכונה: ״{question.options[question.correctIndex]}״</>}
                  </small>
                  {question.mine && (
                    <ConfirmButton label="מחיקה" confirmLabel="כן, למחוק" question="למחוק את השאלה?" onConfirm={() => removeQuestion(question)} />
                  )}
                </li>
              ))}
            </ol>
          )}
          <QuestionForm
            lessonId={lessonId}
            canShare={data.canShare}
            onCreated={(created) => quiz.setData({ ...data, questions: [...questions, created] })}
          />
          <button type="button" className="lesson-inline-button" onClick={() => setMode('overview')}>סיום עריכה</button>
        </div>
      )}
    </section>
  );
}
