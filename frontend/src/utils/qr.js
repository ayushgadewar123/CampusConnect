export const makeQrMatrix = (text, size = 21) => {
  const matrix = Array.from({ length: size }, () => Array(size).fill(false));
  const seedBase = String(text || "");
  let seed = 0;
  for (let i = 0; i < seedBase.length; i += 1) {
    seed = (seed * 31 + seedBase.charCodeAt(i)) >>> 0;
  }

  const rand = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };

  const addFinder = (x, y) => {
    for (let row = 0; row < 7; row += 1) {
      for (let col = 0; col < 7; col += 1) {
        const onEdge = row === 0 || row === 6 || col === 0 || col === 6;
        const inCore = row >= 2 && row <= 4 && col >= 2 && col <= 4;
        matrix[y + row][x + col] = onEdge || inCore;
      }
    }
  };

  addFinder(0, 0);
  addFinder(size - 7, 0);
  addFinder(0, size - 7);

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const inFinder = (row < 7 && col < 7) || (row < 7 && col >= size - 7) || (row >= size - 7 && col < 7);
      if (inFinder) continue;
      matrix[row][col] = rand() > 0.5;
    }
  }

  return matrix;
};
