import { describe, expect, it } from 'vitest';
import Line from './line';

it('should calculate distance to point', () => {
  const line = new Line([0, 0], [1, 0]);
  expect(line.distToPoint([0.5, 0.5])).toBe(0.5);
  expect(line.distToPoint([1.5, 0.5])).toBeCloseTo(0.707, 3);
  expect(line.distToPoint([1.5, 0])).toBe(0.5);
  expect(line.distToPoint([1.5, -0.5])).toBeCloseTo(0.707, 3);
  expect(line.distToPoint([0.5, -0.5])).toBe(0.5);
  expect(line.distToPoint([-0.5, -0.5])).toBeCloseTo(0.707, 3);
  expect(line.distToPoint([-0.5, 0])).toBe(0.5);
  expect(line.distToPoint([-0.5, 0.5])).toBeCloseTo(0.707, 3);
  expect(line.distToPoint([1.1, 0.1])).toBeCloseTo(0.141, 3);
});

describe('line.distToLine', () => {
  const line = new Line([0, 0], [1, 0]);

  it('when lines are identical', () => {
    expect(line.distToLine(new Line([0, 0], [1, 0]))).toBe(0);
  });

  it('when lines are parallel', () => {
    expect(line.distToLine(new Line([0, 1], [1, 1]))).toBe(1);
    expect(line.distToLine(new Line([0, -1], [1, -1]))).toBe(1);
    expect(new Line([0, 0], [0, 1]).distToLine(new Line([1, 0], [1, 1]))).toBe(
      1
    );
  });

  it('when lines are parallel but not next to each other', () => {
    expect(line.distToLine(new Line([2, 1], [3, 1]))).toBeCloseTo(1.414, 3);
    expect(line.distToLine(new Line([3, -2], [2, -2]))).toBeCloseTo(2.236, 3);
  });

  it('when lines are touching', () => {
    expect(line.distToLine(new Line([0, 0], [0, 1]))).toBe(0);
    expect(line.distToLine(new Line([1, 0], [2, 0]))).toBe(0);
    expect(line.distToLine(new Line([1, 0], [2, 1]))).toBe(0);
  });

  it('when lines are intersecting', () => {
    expect(line.distToLine(new Line([0.5, -0.5], [0.5, 0.5]))).toBe(0);
    expect(line.distToLine(new Line([1.1, 0.5], [0.6, -0.5]))).toBe(0);
  });

  it('when lines are not intersecting but tips closest', () => {
    expect(line.distToLine(new Line([0, 1], [1, 4]))).toBe(1);
    expect(line.distToLine(new Line([2, -1], [4, -2]))).toBeCloseTo(1.414, 3);
  });

  it('when lines are not intersecting and tips not closest', () => {
    expect(line.distToLine(new Line([0.5, 0.1], [1, 1]))).toBe(0.1);
    expect(line.distToLine(new Line([0.6, -0.1], [1, -1]))).toBe(0.1);
    expect(line.distToLine(new Line([1, -1], [0.6, -0.1]))).toBe(0.1);
  });

  it('tips not closest but intersection of extended line on other side to closest point (bug fix)', () => {
    expect(line.distToLine(new Line([1.1, 0.1], [2.1, 0.15]))).toBeCloseTo(
      0.141,
      3
    );
  });
});
