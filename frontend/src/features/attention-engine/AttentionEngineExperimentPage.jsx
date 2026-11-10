import AttentionEnginePanel from './AttentionEnginePanel.jsx';

/** Development-only page (/__experiments/attention-engine): no login, no backend. */
export default function AttentionEngineExperimentPage() {
  return (
    <main className="signature-production ae-experiment-page" dir="rtl" lang="he">
      <div className="ae-experiment-container">
        <AttentionEnginePanel />
        <p className="ae-note">
          סביבת פיתוח: הדף זמין רק ב-npm run dev. בעמוד הלמידה אפשר להפעיל את המנוע בכתובת /learning?engine=new.
        </p>
      </div>
    </main>
  );
}
