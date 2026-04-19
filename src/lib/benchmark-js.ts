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
  left: number[];
  right: number[];
} {
  const total = size * size;
  const left = new Array<number>(total);
  const right = new Array<number>(total);

  for (let index = 0; index < total; index += 1) {
    left[index] = ((index * 17 + 7) % 101) + 1;
    right[index] = ((index * 29 + 13) % 97) + 1;
  }

  return { left, right };
}

export function multiplyMatricesJs(
  left: number[],
  right: number[],
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

export function createVectorInput(size: number): {
  left: number[];
  right: number[];
} {
  const left = new Array<number>(size);
  const right = new Array<number>(size);

  for (let index = 0; index < size; index += 1) {
    left[index] = ((index * 11 + 3) % 1_009) / 10;
    right[index] = ((index * 7 + 19) % 997) / 10;
  }

  return { left, right };
}

export function dotProductJs(left: number[], right: number[]): number {
  let sum = 0;

  for (let index = 0; index < left.length; index += 1) {
    sum += left[index] * right[index];
  }

  return sum;
}

export function summarizeResult(result: number | number[]): string {
  if (typeof result === "number") {
    return Number.isInteger(result) ? `${result}` : result.toFixed(6);
  }

  const length = result.length;
  const first = result[0] ?? 0;
  const checksum = result.reduce((acc, value) => acc + value, 0);

  return `len=${length}, first=${first.toFixed(4)}, checksum=${checksum.toFixed(4)}`;
}
