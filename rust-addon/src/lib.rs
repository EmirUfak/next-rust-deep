use std::time::Instant;

use napi::{Error, Result};
use napi_derive::napi;
use rayon::prelude::*;

const MAX_PRIME_LIMIT: u32 = 50_000_000;
const MAX_MATRIX_SIZE: usize = 512;
const MAX_VECTOR_SIZE: usize = 10_000_000;
const MAX_BATCH_ITERATIONS: u32 = 1_000;

const MIN_PARALLEL_PRIME_LIMIT: u32 = 100_000;
const MIN_PARALLEL_MATRIX_SIZE: usize = 48;
const MIN_PARALLEL_VECTOR_SIZE: usize = 32_768;

#[napi(object)]
pub struct PrimeTimedResult {
    pub result: u32,
    pub compute_ms: f64,
}

#[napi(object)]
pub struct DotTimedResult {
    pub result: f64,
    pub compute_ms: f64,
}

#[napi(object)]
pub struct MatrixSummaryTimedResult {
    pub length: u32,
    pub first: f64,
    pub checksum: f64,
    pub compute_ms: f64,
}

#[derive(Clone, Copy)]
struct MatrixShape {
    size: usize,
    expected_len: usize,
}

#[derive(Clone, Copy)]
struct MatrixSummaryRaw {
    length: usize,
    first: f64,
    checksum: f64,
}

fn error(message: &str) -> Error {
    Error::from_reason(message.to_owned())
}

#[must_use]
fn is_prime(value: u32) -> bool {
    if value == 2 {
        return true;
    }

    if value < 2 || value % 2 == 0 {
        return false;
    }

    let mut divisor = 3;
    while divisor <= value / divisor {
        if value % divisor == 0 {
            return false;
        }

        divisor += 2;
    }

    true
}

fn validate_prime_limit(limit: u32) -> Result<()> {
    if limit > MAX_PRIME_LIMIT {
        return Err(error("limit exceeds maximum allowed size"));
    }

    Ok(())
}

fn validate_iterations(iterations: u32) -> Result<u32> {
    if iterations == 0 {
        return Err(error("iterations must be greater than zero"));
    }

    if iterations > MAX_BATCH_ITERATIONS {
        return Err(error("iterations exceed maximum batch size"));
    }

    Ok(iterations)
}

fn validate_matrix_shape(left: &[f64], right: &[f64], size: u32) -> Result<MatrixShape> {
    let size = usize::try_from(size).map_err(|_| error("matrix size conversion failed"))?;

    if size == 0 {
        return Err(error("matrix size must be greater than zero"));
    }

    if size > MAX_MATRIX_SIZE {
        return Err(error("matrix size exceeds maximum allowed size"));
    }

    let expected_len = size
        .checked_mul(size)
        .ok_or_else(|| error("matrix size overflow"))?;

    if left.len() != expected_len || right.len() != expected_len {
        return Err(error("matrix data length does not match size * size"));
    }

    Ok(MatrixShape { size, expected_len })
}

fn validate_vector_shape(left: &[f64], right: &[f64]) -> Result<usize> {
    if left.is_empty() || right.is_empty() {
        return Err(error("vectors must be non-empty"));
    }

    if left.len() != right.len() {
        return Err(error("vectors must have identical lengths"));
    }

    if left.len() > MAX_VECTOR_SIZE {
        return Err(error("vector size exceeds maximum allowed size"));
    }

    Ok(left.len())
}

fn count_primes_core(limit: u32) -> Result<u32> {
    if limit < 2 {
        return Ok(0);
    }

    if limit < MIN_PARALLEL_PRIME_LIMIT {
        let mut count = 0_u32;

        for candidate in 2..=limit {
            if is_prime(candidate) {
                count = count
                    .checked_add(1)
                    .ok_or_else(|| error("prime count exceeds u32 range"))?;
            }
        }

        return Ok(count);
    }

    let count = (2..=limit)
        .into_par_iter()
        .filter(|&candidate| is_prime(candidate))
        .count();

    u32::try_from(count).map_err(|_| error("prime count exceeds u32 range"))
}

fn matrix_multiply_core(left: &[f64], right: &[f64], size: usize) -> Vec<f64> {
    let expected_len = size * size;
    let mut output = vec![0.0; expected_len];

    if size < MIN_PARALLEL_MATRIX_SIZE {
        for row in 0..size {
            for k in 0..size {
                let left_value = left[row * size + k];

                for column in 0..size {
                    output[row * size + column] += left_value * right[k * size + column];
                }
            }
        }

        return output;
    }

    output
        .par_chunks_mut(size)
        .enumerate()
        .for_each(|(row_idx, row)| {
            for k in 0..size {
                let left_value = left[row_idx * size + k];

                for column in 0..size {
                    row[column] += left_value * right[k * size + column];
                }
            }
        });

    output
}

fn matrix_summary_core(left: &[f64], right: &[f64], size: usize) -> MatrixSummaryRaw {
    let expected_len = size * size;

    if size < MIN_PARALLEL_MATRIX_SIZE {
        let mut first = 0.0;
        let mut checksum = 0.0;

        for row in 0..size {
            for column in 0..size {
                let mut value = 0.0;

                for k in 0..size {
                    value += left[row * size + k] * right[k * size + column];
                }

                if row == 0 && column == 0 {
                    first = value;
                }

                checksum += value;
            }
        }

        return MatrixSummaryRaw {
            length: expected_len,
            first,
            checksum,
        };
    }

    let rows: Vec<(f64, f64)> = (0..size)
        .into_par_iter()
        .map(|row| {
            let mut row_checksum = 0.0;
            let mut row_first = 0.0;

            for column in 0..size {
                let mut value = 0.0;

                for k in 0..size {
                    value += left[row * size + k] * right[k * size + column];
                }

                if row == 0 && column == 0 {
                    row_first = value;
                }

                row_checksum += value;
            }

            (row_checksum, row_first)
        })
        .collect();

    let mut checksum = 0.0;
    let mut first = 0.0;

    for (row_idx, (row_checksum, row_first)) in rows.into_iter().enumerate() {
        checksum += row_checksum;

        if row_idx == 0 {
            first = row_first;
        }
    }

    MatrixSummaryRaw {
        length: expected_len,
        first,
        checksum,
    }
}

fn dot_product_core(left: &[f64], right: &[f64], length: usize) -> f64 {
    if length < MIN_PARALLEL_VECTOR_SIZE {
        let mut sum = 0.0;

        for index in 0..length {
            sum += left[index] * right[index];
        }

        return sum;
    }

    left.par_iter()
        .zip(right.par_iter())
        .map(|(lhs, rhs)| lhs * rhs)
        .sum()
}

fn matrix_summary_result_from_raw(
    summary: MatrixSummaryRaw,
    compute_ms: f64,
) -> Result<MatrixSummaryTimedResult> {
    let length = u32::try_from(summary.length).map_err(|_| error("matrix summary length overflow"))?;

    Ok(MatrixSummaryTimedResult {
        length,
        first: summary.first,
        checksum: summary.checksum,
        compute_ms,
    })
}

/// Count prime numbers up to `limit` in parallel.
///
/// # Errors
/// Returns an error when `limit` exceeds the configured safeguard.
#[napi(js_name = "countPrimes")]
pub fn count_primes(limit: u32) -> Result<u32> {
    validate_prime_limit(limit)?;
    count_primes_core(limit)
}

/// Count prime numbers and return native compute timing in milliseconds.
///
/// # Errors
/// Returns an error when `limit` exceeds the configured safeguard.
#[napi(js_name = "countPrimesTimed")]
pub fn count_primes_timed(limit: u32) -> Result<PrimeTimedResult> {
    validate_prime_limit(limit)?;

    let started = Instant::now();
    let result = count_primes_core(limit)?;
    let compute_ms = started.elapsed().as_secs_f64() * 1000.0;

    Ok(PrimeTimedResult { result, compute_ms })
}

/// Batch prime counting in one native call and return average native compute timing.
///
/// # Errors
/// Returns an error when arguments exceed configured safeguards.
#[napi(js_name = "countPrimesBatchTimed")]
pub fn count_primes_batch_timed(limit: u32, iterations: u32) -> Result<PrimeTimedResult> {
    validate_prime_limit(limit)?;
    let iterations = validate_iterations(iterations)?;

    let mut result = 0_u32;
    let mut total_compute_ms = 0.0;

    for _ in 0..iterations {
        let started = Instant::now();
        result = count_primes_core(limit)?;
        total_compute_ms += started.elapsed().as_secs_f64() * 1000.0;
    }

    Ok(PrimeTimedResult {
        result,
        compute_ms: total_compute_ms / f64::from(iterations),
    })
}

/// Multiply two N x N matrices represented as flattened row-major arrays.
///
/// # Errors
/// Returns an error when size or vector lengths are invalid.
#[napi(js_name = "matrixMultiplyParallel")]
pub fn matrix_multiply_parallel(left: &[f64], right: &[f64], size: u32) -> Result<Vec<f64>> {
    let shape = validate_matrix_shape(left, right, size)?;
    Ok(matrix_multiply_core(left, right, shape.size))
}

/// Multiply matrix inputs and return summary with native compute timing.
///
/// # Errors
/// Returns an error when size or vector lengths are invalid.
#[napi(js_name = "matrixMultiplySummaryTimed")]
pub fn matrix_multiply_summary_timed(
    left: &[f64],
    right: &[f64],
    size: u32,
) -> Result<MatrixSummaryTimedResult> {
    let shape = validate_matrix_shape(left, right, size)?;

    let started = Instant::now();
    let summary = matrix_summary_core(left, right, shape.size);
    let compute_ms = started.elapsed().as_secs_f64() * 1000.0;

    matrix_summary_result_from_raw(summary, compute_ms)
}

/// Batch matrix summary computation in one native call and return average native compute timing.
///
/// # Errors
/// Returns an error when arguments exceed configured safeguards.
#[napi(js_name = "matrixMultiplySummaryBatchTimed")]
pub fn matrix_multiply_summary_batch_timed(
    left: &[f64],
    right: &[f64],
    size: u32,
    iterations: u32,
) -> Result<MatrixSummaryTimedResult> {
    let shape = validate_matrix_shape(left, right, size)?;
    let iterations = validate_iterations(iterations)?;

    let mut summary = MatrixSummaryRaw {
        length: shape.expected_len,
        first: 0.0,
        checksum: 0.0,
    };
    let mut total_compute_ms = 0.0;

    for _ in 0..iterations {
        let started = Instant::now();
        summary = matrix_summary_core(left, right, shape.size);
        total_compute_ms += started.elapsed().as_secs_f64() * 1000.0;
    }

    matrix_summary_result_from_raw(summary, total_compute_ms / f64::from(iterations))
}

/// Compute dot product for two vectors in parallel.
///
/// # Errors
/// Returns an error when vectors are empty, oversized, or shape-mismatched.
#[napi(js_name = "dotProductParallel")]
pub fn dot_product_parallel(left: &[f64], right: &[f64]) -> Result<f64> {
    let length = validate_vector_shape(left, right)?;
    Ok(dot_product_core(left, right, length))
}

/// Compute dot product and return native compute timing in milliseconds.
///
/// # Errors
/// Returns an error when vectors are empty, oversized, or shape-mismatched.
#[napi(js_name = "dotProductTimed")]
pub fn dot_product_timed(left: &[f64], right: &[f64]) -> Result<DotTimedResult> {
    let length = validate_vector_shape(left, right)?;

    let started = Instant::now();
    let result = dot_product_core(left, right, length);
    let compute_ms = started.elapsed().as_secs_f64() * 1000.0;

    Ok(DotTimedResult { result, compute_ms })
}

/// Batch dot product in one native call and return average native compute timing.
///
/// # Errors
/// Returns an error when arguments exceed configured safeguards.
#[napi(js_name = "dotProductBatchTimed")]
pub fn dot_product_batch_timed(
    left: &[f64],
    right: &[f64],
    iterations: u32,
) -> Result<DotTimedResult> {
    let length = validate_vector_shape(left, right)?;
    let iterations = validate_iterations(iterations)?;

    let mut result = 0.0;
    let mut total_compute_ms = 0.0;

    for _ in 0..iterations {
        let started = Instant::now();
        result = dot_product_core(left, right, length);
        total_compute_ms += started.elapsed().as_secs_f64() * 1000.0;
    }

    Ok(DotTimedResult {
        result,
        compute_ms: total_compute_ms / f64::from(iterations),
    })
}

#[cfg(test)]
mod tests {
    use super::{
        count_primes, dot_product_parallel, matrix_multiply_parallel, matrix_multiply_summary_timed,
    };

    #[test]
    fn count_primes_matches_expected_value() {
        let result = count_primes(30);
        assert!(result.is_ok());
        assert_eq!(result.ok(), Some(10));
    }

    #[test]
    fn matrix_multiply_matches_expected_output() {
        let left = [1.0, 2.0, 3.0, 4.0];
        let right = [5.0, 6.0, 7.0, 8.0];

        let result = matrix_multiply_parallel(&left, &right, 2);
        assert!(result.is_ok());

        let matrix = result.ok().unwrap_or_default();
        let expected = [19.0, 22.0, 43.0, 50.0];

        for (actual, expected_value) in matrix.iter().zip(expected.iter()) {
            assert!((actual - expected_value).abs() < 1e-12);
        }
    }

    #[test]
    fn matrix_summary_matches_expected_output() {
        let left = [1.0, 2.0, 3.0, 4.0];
        let right = [5.0, 6.0, 7.0, 8.0];

        let result = matrix_multiply_summary_timed(&left, &right, 2);
        assert!(result.is_ok());

        let summary = result.expect("matrix summary should succeed");

        assert_eq!(summary.length, 4);
        assert!((summary.first - 19.0).abs() < 1e-12);
        assert!((summary.checksum - 134.0).abs() < 1e-12);
        assert!(summary.compute_ms >= 0.0);
    }

    #[test]
    fn dot_product_matches_expected_output() {
        let left = [1.0, 2.0, 3.0];
        let right = [4.0, 5.0, 6.0];

        let result = dot_product_parallel(&left, &right);
        assert!(result.is_ok());

        let value = result.ok().unwrap_or_default();
        assert!((value - 32.0).abs() < 1e-12);
    }
}
