import { describe, expect, test } from 'vitest';
import { parseFile } from '../../../../src/core/treeSitter/parseFile.js';
import { createMockConfig } from '../../../testing/testUtils.js';

const compress = async (lines: string[]) => {
  const result = await parseFile(lines.join('\n'), 'sample.py', createMockConfig({}));
  if (result === undefined) throw new Error('parseFile returned undefined');
  return result;
};

describe('PythonParseStrategy function signatures', () => {
  // Formatters such as Black wrap long signatures, so a definition often spans several
  // lines. The signature used to be read from the `def` line alone, and a definition
  // whose first line didn't hold the whole signature was dropped from the output.
  test('keeps a signature that spans several lines', async () => {
    const result = await compress([
      'def wrapped(',
      '    first_argument: int,',
      '    second_argument: str = "x",',
      ') -> dict[str, int]:',
      '    return {}',
    ]);

    expect(result).toContain(
      ['def wrapped(', '    first_argument: int,', '    second_argument: str = "x",', ') -> dict[str, int]'].join('\n'),
    );
    expect(result).not.toContain('return {}');
  });

  test('keeps wrapped async functions and methods', async () => {
    const result = await compress([
      'async def fetch(',
      '    url: str,',
      ') -> bytes:',
      '    return b""',
      '',
      'class Service:',
      '    def handle(',
      '        self,',
      '        request,',
      '    ):',
      '        pass',
    ]);

    expect(result).toContain(['async def fetch(', '    url: str,', ') -> bytes'].join('\n'));
    // parseFile trims each chunk, so the method's first line loses its indent.
    expect(result).toContain(['def handle(', '        self,', '        request,', '    )'].join('\n'));
  });

  // `\w` in a JavaScript regex only matches ASCII, but Python identifiers may be any
  // Unicode letters.
  test('keeps functions with non-ASCII names', async () => {
    const result = await compress(['def café(x):', '    return x', '', 'def 関数(引数):', '    return 引数']);

    expect(result).toContain('def café(x)');
    expect(result).toContain('def 関数(引数)');
  });

  test('keeps one-line signatures as before', async () => {
    const result = await compress([
      'def f(d={"a": 1}) -> None:',
      '    pass',
      '',
      'def greet(name): print(f"Hello, {name}")',
    ]);

    expect(result).toContain('def f(d={"a": 1}) -> None');
    expect(result).toContain('def greet(name): print(f"Hello, {name}")');
  });
});
