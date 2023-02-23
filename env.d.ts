/// <reference types="vite/client" />

// Incomplete jstat types from https://github.com/jstat/jstat/pull/271
declare class JStatObject {
  /**
   * Returns the p-value of value of the vector in the jStatObject.
   * sides is an integer value 1 or 2 denoting a one or two
   * sided z-test. If sides is not specified the test defaults
   * to a two sided z-test.
   *
   * flag===true denotes the use of the sample standard deviation.
   * @param x
   * @param sides
   * @param flag
   * @example
   * jStat([1,2,3,4,5,6]).ztest(5)
   * // => 0.379775474840949
   * jStat([1,2,3,4,5,6]).ztest(5, 1, true)
   * // => 0.21133903708531765
   */
  ztest(x: number, sides?: 1 | 2, flag?: boolean): number;
}

declare module "jstat" {
  /**
   * Create an empty JStatObject object
   */
  export function jStat(): JStatObject;

  /**
   * Create a JStatObject from a matrix object
   * @param matrix
   * @param transformFn
   */
  export function jStat(
    matrix: number[][],
    transformFn?: (x: number, count: number) => number
  ): JStatObject;

  /**
   * create a new jStat from a vector object
   * @param vector
   * @param transformFn
   */
  export function jStat(
    vector: number[],
    transformFn?: (x: number, count: number) => number
  ): JStatObject;

  /**
   * Creates a new jStat object from a sequence (same form jStat.seq())
   * @param start
   * @param stop
   * @param count
   * @param transformFn
   */
  export function jStat(
    start: number,
    stop: number,
    count: number,
    transformFn?: (x: number, count: number) => number
  ): JStatObject;
}
