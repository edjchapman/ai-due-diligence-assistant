interface CompanyPickerProps {
  companies: string[] | 'loading' | 'error';
  onPick: (company: string) => void;
}

export function CompanyPicker({ companies, onPick }: CompanyPickerProps) {
  if (companies === 'loading') return <div className="controls hint-inline">Loading…</div>;
  if (companies === 'error')
    return <div className="controls hint-inline">Error loading companies.</div>;
  if (companies.length === 0)
    return <div className="controls hint-inline">No companies ingested yet — run `make demo`.</div>;
  return (
    <div className="controls">
      {companies.map((c) => (
        <button
          key={c}
          className="company"
          onClick={() => {
            onPick(c);
          }}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
