// A labelled input / textarea / select with inline hint and error text.
export default function Field({
  id,
  label,
  error,
  hint,
  optional = false,
  as: Tag = "input",
  className = "",
  children,
  ...rest
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className={`field ${error ? "has-error" : ""} ${className}`.trim()}>
      <label htmlFor={id}>
        {label}
        {optional && <span className="optional">optional</span>}
      </label>
      <Tag
        id={id}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
        {...rest}
      >
        {children}
      </Tag>
      {error ? (
        <p className="error" id={errorId}>
          {error}
        </p>
      ) : hint ? (
        <p className="hint" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
