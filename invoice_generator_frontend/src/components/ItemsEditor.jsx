import Field from "./Field.jsx";
import { formatCents } from "../lib/decimal.js";

export const MAX_ITEMS = 100; // backend: items max_length=100

export default function ItemsEditor({ items, lineAmounts, currencyLabel, field, onAdd, onRemove }) {
  return (
    <div className="items">
      <div className="items-head" aria-hidden="true">
        <span>Description</span>
        <span className="num">Qty</span>
        <span className="num">Rate</span>
        <span className="num">Amount</span>
        <span />
      </div>

      <ol className="items-list">
        {items.map((item, i) => {
          const amount = lineAmounts[i];
          return (
            <li className="item-row" key={item.id}>
              <Field
                label={<><span className="sr-only">Item {i + 1} </span>Description</>}
                placeholder="e.g. Website development"
                autoComplete="off"
                className="col-desc"
                {...field(`items.${i}.description`)}
              />
              <Field
                label={<><span className="sr-only">Item {i + 1} </span>Quantity</>}
                inputMode="decimal"
                placeholder="1"
                autoComplete="off"
                className="col-qty"
                {...field(`items.${i}.quantity`)}
              />
              <Field
                label={<><span className="sr-only">Item {i + 1} </span>Rate</>}
                inputMode="decimal"
                placeholder="0.00"
                autoComplete="off"
                className="col-rate"
                {...field(`items.${i}.rate`)}
              />
              <div className="col-amount">
                <span className="mobile-label">Amount</span>
                <output aria-label={`Item ${i + 1} amount`}>
                  {amount === null ? "–" : formatCents(amount, currencyLabel)}
                </output>
              </div>
              <button
                type="button"
                className="icon-button col-remove"
                onClick={() => onRemove(item.id)}
                disabled={items.length === 1}
                aria-label={`Remove item ${i + 1}`}
                title={items.length === 1 ? "An invoice needs at least one item" : "Remove item"}
              >
                <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                  <path
                    d="M5 5l10 10M15 5L5 15"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              </button>
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        className="button secondary add-item"
        onClick={onAdd}
        disabled={items.length >= MAX_ITEMS}
      >
        Add item
      </button>
    </div>
  );
}
