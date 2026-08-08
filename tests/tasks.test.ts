import { describe, expect, it } from 'vitest';
import { calculateNextDueDate, isCompletionTransition, isTaskAssignment, parseRecurrence } from '../functions/_shared/tasks';

describe('task rules',()=>{
 it('validates assignment modes',()=>{
  for(const value of ['anyone','misiek','miska','both'])expect(isTaskAssignment(value)).toBe(true);
  expect(isTaskAssignment('someone')).toBe(false);
 });
 it('validates recurrence ranges',()=>{
  expect(parseRecurrence({unit:'day',interval:5})).toEqual({unit:'day',interval:5});
  expect(parseRecurrence({unit:'day',interval:0})).toBeUndefined();
  expect(parseRecurrence({unit:'year',interval:1})).toBeUndefined();
 });
 it('calculates daily, weekly, and month-end recurrence',()=>{
  expect(calculateNextDueDate('2026-08-08T00:00:00.000Z',{unit:'day',interval:5})).toBe('2026-08-13T00:00:00.000Z');
  expect(calculateNextDueDate('2026-08-08T00:00:00.000Z',{unit:'week',interval:2})).toBe('2026-08-22T00:00:00.000Z');
  expect(calculateNextDueDate('2026-01-31T00:00:00.000Z',{unit:'month',interval:1})).toBe('2026-02-28T00:00:00.000Z');
 });
 it('only generates completion side effects on the first transition',()=>{
  expect(isCompletionTransition(false,true)).toBe(true);
  expect(isCompletionTransition(true,true)).toBe(false);
  expect(isCompletionTransition(true,false)).toBe(false);
 });
});
