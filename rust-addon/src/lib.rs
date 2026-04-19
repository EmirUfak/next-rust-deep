use napi::{Error, Result};
use napi_derive::napi;
use rayon::prelude::*;

const MAX_PRIME_LIMIT: u32 = 50_000_000;
const MAX_MATRIX_SIZE: usize = 512;
const MAX_VECTOR_SIZE: usize = 10_000_000;

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

/// Count prime numbers up to `limit` in parallel.
///
/// # Errors
/// Returns an error when `limit` exceeds the configured safeguard.
#[napi(js_name = "countPrimes")]
pub fn count_primes(limit: u32) -> Result<u32> {
    if limit > MAX_PRIME_LIMIT {
        return Err(error("limit exceeds maximum allowed size"));
    }

    let count = (2..=limit)
        .into_par_iter()
        .filter(|&candidate| is_prime(candidate))
        .count();

    u32::try_from(count).map_err(|_| error("prime count exceeds u32 range"))
}

/// Multiply two N x N matrices represented as flattened row-major arrays.
///
/// # Errors
/// Returns an error when size or vector lengths are invalid.
#[allow(clippy::needless_pass_by_value)]
#[napi(js_name = "matrixMultiplyParallel")]
pub fn matrix_multiply_parallel(left: Vec<f64>, right: Vec<f64>, size: u32) -> Result<Vec<f64>> {
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

    let mut output = vec![0.0; expected_len];

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

    Ok(output)
}

/// Compute dot product for two vectors in parallel.
///
/// # Errors
/// Returns an error when vectors are empty, oversized, or shape-mismatched.
#[allow(clippy::needless_pass_by_value)]
#[napi(js_name = "dotProductParallel")]
pub fn dot_product_parallel(left: Vec<f64>, right: Vec<f64>) -> Result<f64> {
    if left.is_empty() || right.is_empty() {
        return Err(error("vectors must be non-empty"));
    }

    if left.len() != right.len() {
        return Err(error("vectors must have identical lengths"));
    }

    if left.len() > MAX_VECTOR_SIZE {
        return Err(error("vector size exceeds maximum allowed size"));
    }

    let value = left
        .par_iter()
        .zip(right.par_iter())
        .map(|(lhs, rhs)| lhs * rhs)
        .sum();

    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::{count_primes, dot_product_parallel, matrix_multiply_parallel};

    #[test]
    fn count_primes_matches_expected_value() {
        let result = count_primes(30);
        assert!(result.is_ok());
        assert_eq!(result.ok(), Some(10));
    }

    #[test]
    fn matrix_multiply_matches_expected_output() {
        let left = vec![1.0, 2.0, 3.0, 4.0];
        let right = vec![5.0, 6.0, 7.0, 8.0];

        let result = matrix_multiply_parallel(left, right, 2);
        assert!(result.is_ok());

        let matrix = result.ok().unwrap_or_default();
        let expected = [19.0, 22.0, 43.0, 50.0];

        for (actual, expected_value) in matrix.iter().zip(expected.iter()) {
            assert!((actual - expected_value).abs() < 1e-12);
        }
    }

    #[test]
    fn dot_product_matches_expected_output() {
        let result = dot_product_parallel(vec![1.0, 2.0, 3.0], vec![4.0, 5.0, 6.0]);
        assert!(result.is_ok());

        let value = result.ok().unwrap_or_default();
        assert!((value - 32.0).abs() < 1e-12);
    }
}
