import { API_BASE } from "../lib/api.js";

const COPY = {
  checking: "Checking server…",
  up: "Server connected",
  down: "Server not reachable",
};

export default function ServerStatus({ state, onRetry }) {
  return (
    <>
      <button
        type="button"
        className={`status status-${state}`}
        onClick={onRetry}
        title={`${API_BASE} (select to check again)`}
      >
        <span className="dot" aria-hidden="true" />
        {COPY[state]}
      </button>
      {/* Announces changes to screen readers; kept outside the button on purpose. */}
      <span className="sr-only" role="status">
        {COPY[state]}
      </span>
    </>
  );
}
