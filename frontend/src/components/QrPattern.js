import { makeQrMatrix } from "../utils/qr";

export default function QrPattern({ value, size = 21 }) {
  const matrix = makeQrMatrix(value, size);
  return (
    <div className="qr-wrap" aria-label="QR style ticket preview">
      <div className="qr-grid" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
        {matrix.flatMap((row, r) => row.map((cell, c) => <span key={`${r}-${c}`} className={cell ? "qr-dot on" : "qr-dot"} />))}
      </div>
    </div>
  );
}
