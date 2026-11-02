import { initials, shortName } from './names';

describe('shortName', () => {
  it('takes the first word and capitalises it', () => {
    expect(shortName('dharmesh kumar')).toBe('Dharmesh');
    expect(shortName('aiworkseveryday')).toBe('Aiworkseve…');
    expect(shortName('ravi.k99')).toBe('Ravi');
  });

  it('falls back when empty', () => {
    expect(shortName(null)).toBe('there');
    expect(shortName('   ')).toBe('there');
  });
});

describe('initials', () => {
  it('uses two words or the first two letters', () => {
    expect(initials('Dharmesh Kumar')).toBe('DK');
    expect(initials('aiworkseveryday')).toBe('AI');
    expect(initials('')).toBe('?');
  });
});
