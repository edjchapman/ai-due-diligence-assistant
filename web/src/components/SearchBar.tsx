import { useState } from 'react';

const SUGGESTIONS = ['related-party lease', 'going concern', 'largest customer', 'auditor change'];

interface SearchBarProps {
  onSearch: (query: string) => void;
}

export function SearchBar({ onSearch }: SearchBarProps) {
  const [query, setQuery] = useState('');

  const submit = (q: string) => {
    const trimmed = q.trim();
    if (trimmed) onSearch(trimmed);
  };

  return (
    <>
      <form
        className="controls"
        id="search-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit(query);
        }}
      >
        <input
          id="q"
          placeholder="e.g. related-party lease"
          aria-label="Search query"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
        />
        <button id="searchBtn" type="submit">
          Search
        </button>
      </form>
      <div className="controls suggestions">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            className="chip"
            onClick={() => {
              setQuery(s);
              submit(s);
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </>
  );
}
