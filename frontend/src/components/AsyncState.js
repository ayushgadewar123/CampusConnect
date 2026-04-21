import { FaRedo, FaInbox, FaExclamationTriangle, FaSpinner } from "react-icons/fa";

const iconMap = {
  loading: FaSpinner,
  empty: FaInbox,
  error: FaExclamationTriangle,
};

export default function AsyncState({
  variant = "empty",
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}) {
  const Icon = iconMap[variant] || FaInbox;

  return (
    <div className={`state-panel ${variant}`}>
      <div className="state-icon">
        <Icon className={variant === "loading" ? "state-spin" : ""} />
      </div>
      <div className="state-copy">
        {title && <strong>{title}</strong>}
        {description && <p>{description}</p>}
      </div>
      <div className="state-actions">
        {actionLabel && onAction && (
          <button className="primary-btn tiny" type="button" onClick={onAction}>
            {variant === "loading" ? <FaSpinner className="state-spin" /> : <FaRedo />}
            {actionLabel}
          </button>
        )}
        {secondaryActionLabel && onSecondaryAction && (
          <button className="secondary-btn tiny" type="button" onClick={onSecondaryAction}>
            {secondaryActionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
