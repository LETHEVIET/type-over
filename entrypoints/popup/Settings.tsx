import { useEffect, useState } from 'react';
import { DEFAULT_PREFS, Preferences, getPrefs, setPrefs } from '../shared/prefs';

export default function Settings() {
  const [prefs, setLocal] = useState<Preferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getPrefs().then((p) => {
      if (mounted) {
        setLocal(p);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const update = async (patch: Partial<Preferences>) => {
    const next = await setPrefs(patch);
    setLocal(next);
  };

  const cardStyle: React.CSSProperties = {
    minWidth: 300,
    maxWidth: 360,
    background: 'rgba(17,24,39,0.95)',
    color: '#e5e7eb',
    border: '1px solid #374151',
    borderRadius: 10,
    padding: 12,
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
    fontSize: 12,
    lineHeight: 1.4,
    boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
  };

  const labelRow: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const labelCol: React.CSSProperties = { display: 'grid', gap: 6 };

  const inputBase: React.CSSProperties = {
    accentColor: '#60a5fa' as any,
  };

  return (
    <div style={cardStyle}>
      <h2 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>TypeOver Settings</h2>
      {loading ? (
        <div>Loading…</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          <label style={labelRow}>
            <span>Sound effects</span>
            <input
              type="checkbox"
              checked={prefs.sound}
              onChange={(e) => update({ sound: e.target.checked })}
              style={inputBase}
            />
          </label>

          <label style={labelCol}>
            <span>Overlay opacity: {Math.round(prefs.opacity * 100)}%</span>
            <input
              type="range"
              min={0.3}
              max={1}
              step={0.05}
              value={prefs.opacity}
              onChange={(e) => update({ opacity: Number(e.target.value) })}
              style={{ ...inputBase, width: '100%' }}
            />
          </label>

          <label style={labelCol}>
            <span>Font size: {prefs.fontSize}px</span>
            <input
              type="range"
              min={12}
              max={28}
              step={1}
              value={prefs.fontSize}
              onChange={(e) => update({ fontSize: Number(e.target.value) })}
              style={{ ...inputBase, width: '100%' }}
            />
          </label>

          <label style={labelCol}>
            <span>Minimum words: {prefs.minWords}</span>
            <input
              type="number"
              min={1}
              max={2000}
              step={1}
              value={prefs.minWords}
              onChange={(e) => {
                const val = Math.max(1, Math.floor(Number(e.target.value) || 0));
                update({ minWords: val });
              }}
              style={{
                ...inputBase,
                width: '100%',
                padding: 6,
                borderRadius: 6,
                border: '1px solid #374151',
                background: 'rgba(31,41,55,0.6)',
                color: '#e5e7eb',
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}
