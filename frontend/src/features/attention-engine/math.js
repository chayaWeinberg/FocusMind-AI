// Small numeric helpers for the attention engine (no dependencies).

export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function mean(values) {
  if (values.length === 0) return Number.NaN;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function median(values) {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function standardDeviation(values) {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1));
}

/** Median absolute deviation scaled to be comparable with a standard deviation. */
export function robustScale(values) {
  const center = median(values);
  return 1.4826 * median(values.map((value) => Math.abs(value - center)));
}

export function logistic(value) {
  return 1 / (1 + Math.exp(-value));
}

/** Solves A x = b with Gaussian elimination and partial pivoting. Returns null if singular. */
export function solveLinearSystem(matrix, vector) {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    }
    if (Math.abs(augmented[pivot][column]) < 1e-12) return null;
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    for (let row = column + 1; row < size; row += 1) {
      const factor = augmented[row][column] / augmented[column][column];
      for (let index = column; index <= size; index += 1) {
        augmented[row][index] -= factor * augmented[column][index];
      }
    }
  }
  const solution = new Array(size).fill(0);
  for (let row = size - 1; row >= 0; row -= 1) {
    let sum = augmented[row][size];
    for (let index = row + 1; index < size; index += 1) sum -= augmented[row][index] * solution[index];
    solution[row] = sum / augmented[row][row];
  }
  return solution.every(Number.isFinite) ? solution : null;
}

/**
 * Ridge regression on standardized features, one model per output column.
 * Standardization makes the penalty comparable across features measured in
 * degrees (head pose) and in eye-width units (iris offset).
 *
 * @param {number[][]} inputs  n x k
 * @param {number[][]} outputs n x m
 * @param {{ lambda?: number }} [options]
 * @returns {{ predict(input: number[]): number[] } | null}
 */
export function fitRidgeRegression(inputs, outputs, { lambda = 1 } = {}) {
  const count = inputs.length;
  if (count === 0 || outputs.length !== count) return null;
  const featureCount = inputs[0].length;
  const outputCount = outputs[0].length;

  const featureMeans = Array.from({ length: featureCount }, (_, feature) => (
    mean(inputs.map((row) => row[feature]))
  ));
  const featureScales = Array.from({ length: featureCount }, (_, feature) => {
    const scale = standardDeviation(inputs.map((row) => row[feature]));
    return scale > 1e-9 ? scale : 1;
  });
  const standardized = inputs.map((row) => row.map((value, feature) => (
    (value - featureMeans[feature]) / featureScales[feature]
  )));
  const outputMeans = Array.from({ length: outputCount }, (_, output) => (
    mean(outputs.map((row) => row[output]))
  ));

  const gram = Array.from({ length: featureCount }, (_, rowIndex) => (
    Array.from({ length: featureCount }, (__, columnIndex) => (
      standardized.reduce((sum, row) => sum + row[rowIndex] * row[columnIndex], 0)
      + (rowIndex === columnIndex ? lambda : 0)
    ))
  ));

  const weights = [];
  for (let output = 0; output < outputCount; output += 1) {
    const target = standardized.map((row, sample) => row.map((value) => (
      value * (outputs[sample][output] - outputMeans[output])
    )));
    const rightHandSide = Array.from({ length: featureCount }, (_, feature) => (
      target.reduce((sum, row) => sum + row[feature], 0)
    ));
    const solution = solveLinearSystem(gram, rightHandSide);
    if (!solution) return null;
    weights.push(solution);
  }

  return {
    featureMeans,
    featureScales,
    outputMeans,
    weights,
    predict(input) {
      return weights.map((outputWeights, output) => outputMeans[output] + outputWeights.reduce(
        (sum, weight, feature) => sum + weight * ((input[feature] - featureMeans[feature]) / featureScales[feature]),
        0,
      ));
    },
  };
}
