import { initials } from './names';

describe('initials', () => {
  it('uses two words or the first two letters', () => {
    expect(initials('Dharmesh Kumar')).toBe('DK');
    expect(initials('aiworkseveryday')).toBe('AI');
    expect(initials('ravi.k99')).toBe('RK');
    expect(initials('')).toBe('?');
  });
});
