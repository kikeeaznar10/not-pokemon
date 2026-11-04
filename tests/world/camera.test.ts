import { describe, expect, it } from 'vitest';
import { cameraBounds } from '../../src/world/camera';

describe('cameraBounds', () => {
  it('uses the map when it is at least screen-sized', () => {
    expect(cameraBounds(960, 640)).toEqual({ x: 0, y: 0, width: 960, height: 640 });
  });
  it('centres a smaller interior on each axis', () => {
    expect(cameraBounds(320, 256)).toEqual({ x: -96, y: -16, width: 512, height: 288 });
    expect(cameraBounds(960, 256)).toEqual({ x: 0, y: -16, width: 960, height: 288 });
  });
});
