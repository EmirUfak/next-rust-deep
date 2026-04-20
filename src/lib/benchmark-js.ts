export interface MatrixSummary {
  length: number;
  first: number;
  checksum: number;
}

export function countPrimesJs(limit: number): number {
  if (limit < 2) {
    return 0;
  }

  let count = 0;
  for (let value = 2; value <= limit; value += 1) {
    if (isPrime(value)) {
      count += 1;
    }
  }

  return count;
}

function isPrime(value: number): boolean {
  if (value === 2) {
    return true;
  }

  if (value < 2 || value % 2 === 0) {
    return false;
  }

  for (let divisor = 3; divisor <= Math.floor(value / divisor); divisor += 2) {
    if (value % divisor === 0) {
      return false;
    }
  }

  return true;
}

export function createMatrixInput(size: number): {
  left: Float64Array;
  right: Float64Array;
} {
  const total = size * size;
  const left = new Float64Array(total);
  const right = new Float64Array(total);

  for (let index = 0; index < total; index += 1) {
    left[index] = ((index * 17 + 7) % 101) + 1;
    right[index] = ((index * 29 + 13) % 97) + 1;
  }

  return { left, right };
}

export function multiplyMatricesJs(
  left: ArrayLike<number>,
  right: ArrayLike<number>,
  size: number,
): number[] {
  const out = new Array<number>(size * size).fill(0);

  for (let row = 0; row < size; row += 1) {
    for (let k = 0; k < size; k += 1) {
      const leftValue = left[row * size + k];

      for (let column = 0; column < size; column += 1) {
        out[row * size + column] += leftValue * right[k * size + column];
      }
    }
  }

  return out;
}

export function multiplyMatricesSummaryJs(
  left: ArrayLike<number>,
  right: ArrayLike<number>,
  size: number,
): MatrixSummary {
  let first = 0;
  let checksum = 0;

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      let value = 0;

      for (let k = 0; k < size; k += 1) {
        value += left[row * size + k] * right[k * size + column];
      }

      if (row === 0 && column === 0) {
        first = value;
      }

      checksum += value;
    }
  }

  return {
    length: size * size,
    first,
    checksum,
  };
}

export function createVectorInput(size: number): {
  left: Float64Array;
  right: Float64Array;
} {
  const left = new Float64Array(size);
  const right = new Float64Array(size);

  for (let index = 0; index < size; index += 1) {
    left[index] = ((index * 11 + 3) % 1_009) / 10;
    right[index] = ((index * 7 + 19) % 997) / 10;
  }

  return { left, right };
}

export function dotProductJs(
  left: ArrayLike<number>,
  right: ArrayLike<number>,
): number {
  let sum = 0;

  for (let index = 0; index < left.length; index += 1) {
    sum += left[index] * right[index];
  }

  return sum;
}

export function summarizeMatrixSummary(summary: MatrixSummary): string {
  return `len=${summary.length}, first=${summary.first.toFixed(4)}, checksum=${summary.checksum.toFixed(4)}`;
}

export function summarizeResult(result: number | ArrayLike<number>): string {
  if (typeof result === "number") {
    return Number.isInteger(result) ? `${result}` : result.toFixed(6);
  }

  const length = result.length;
  const first = result[0] ?? 0;
  let checksum = 0;

  for (let index = 0; index < length; index += 1) {
    checksum += result[index] ?? 0;
  }

  return `len=${length}, first=${first.toFixed(4)}, checksum=${checksum.toFixed(4)}`;
}
