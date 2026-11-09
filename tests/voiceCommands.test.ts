import { describe, expect, it } from 'vitest';
import { parseCommand } from '../src/lib/voiceCommands';

describe('comandos de voz', () => {
  it.each([
    ['Listo', 'complete'],
    ['ya está, hecho', 'complete'],
    ['pausa', 'pause'],
    ['seguir', 'resume'],
    ['continúa', 'resume'],
    ['siguiente', 'next'],
    ['anterior', 'previous'],
    ['saltar', 'skipRest'],
    ['más tiempo', 'addTime'],
    ['mas tiempo por favor', 'addTime'],
    ['repite', 'repeat'],
  ])('“%s” → %s', (text, cmd) => {
    expect(parseCommand(text)).toBe(cmd);
  });

  it('ignora frases sin comando', () => {
    expect(parseCommand('hola qué tal')).toBeNull();
  });
});
