import { Link } from 'react-router-dom';
import { READER_LABELS } from '../lib/format';

export default function ReaderProblemBanner({ failure, showSettingsLink = true }) {
  if (!failure) return null;
  const name = READER_LABELS[failure.provider] || failure.provider;
  return (
    <div className="error-banner" style={{ marginBottom: 16 }}>
      <strong>{name} couldn’t read resumes.</strong> {failure.message} Until it works, MG-ATS falls back to the
      built-in keyword reader, which can miss things.
      {showSettingsLink && (
        <>
          {' '}
          <Link to="/settings">Open Settings</Link>, then use Read everyone again.
        </>
      )}
    </div>
  );
}
