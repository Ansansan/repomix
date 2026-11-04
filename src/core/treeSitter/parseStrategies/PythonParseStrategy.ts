import type { Node } from 'web-tree-sitter';
import type { ParseContext } from './BaseParseStrategy.js';
import { BaseParseStrategy, type ParseResult } from './BaseParseStrategy.js';

enum CaptureType {
  Comment = 'comment',
  Class = 'definition.class',
  Function = 'definition.function',
  Docstring = 'docstring',
  TypeAlias = 'definition.type_alias',
}

export class PythonParseStrategy extends BaseParseStrategy {
  parseCapture(
    capture: { node: Node; name: string },
    lines: string[],
    processedChunks: Set<string>,
    _context: ParseContext,
  ): string | null {
    const { node, name } = capture;
    const startRow = node.startPosition.row;
    const endRow = node.endPosition.row;

    if (!this.validateLineExists(lines, startRow)) {
      return null;
    }

    const captureTypes = this.getCaptureTypes(name, CaptureType);

    // Class definition
    if (captureTypes.has(CaptureType.Class)) {
      return this.parseClassDefinition(lines, startRow, processedChunks).content;
    }

    // Function definition
    if (captureTypes.has(CaptureType.Function)) {
      return this.parseFunctionDefinition(lines, node, startRow, processedChunks).content;
    }

    // Docstring
    if (captureTypes.has(CaptureType.Docstring)) {
      return this.parseDocstringOrComment(lines, startRow, endRow, processedChunks).content;
    }

    // Comment
    if (captureTypes.has(CaptureType.Comment)) {
      return this.parseDocstringOrComment(lines, startRow, endRow, processedChunks).content;
    }

    // Type alias
    if (captureTypes.has(CaptureType.TypeAlias)) {
      return this.parseTypeAlias(lines, startRow, processedChunks).content;
    }

    return null;
  }

  private getDecorators(lines: string[], startRow: number): string[] {
    const decorators: string[] = [];
    let currentRow = startRow - 1;

    while (currentRow >= 0) {
      const line = lines[currentRow].trim();
      if (line.startsWith('@')) {
        decorators.unshift(line); // Add to beginning to maintain order
      } else {
        break;
      }
      currentRow--;
    }

    return decorators;
  }

  private getClassInheritance(lines: string[], startRow: number): string | null {
    const line = lines[startRow];
    const match = line.match(/class\s+\w+\s*\((.*?)\):/);
    return match ? line.replace(/:\s*$/, '') : line.replace(/:\s*$/, '');
  }

  // A signature runs from the `def` line through the `:` before the body, which can be
  // several lines down once a formatter wraps the parameters. Taking its extent from the
  // syntax tree, rather than matching the `def` line, also keeps non-ASCII names, which
  // a `\w` pattern doesn't match.
  private getFunctionSignature(lines: string[], node: Node): string | null {
    // The capture is either the definition itself or its name.
    const definition = node.type === 'function_definition' ? node : node.parent;
    if (definition?.type !== 'function_definition') return null;

    const startRow = definition.startPosition.row;
    const colon = definition.children.find((child) => child.type === ':');
    const endRow = colon ? colon.endPosition.row : startRow;
    const signatureLines = lines.slice(startRow, endRow + 1);
    if (signatureLines.length === 0) return null;
    return signatureLines.join('\n').replace(/:\s*$/, '');
  }

  private parseClassDefinition(lines: string[], startRow: number, processedChunks: Set<string>): ParseResult {
    const decorators = this.getDecorators(lines, startRow);
    const classDefinition = this.getClassInheritance(lines, startRow);
    const fullDefinition = [...decorators, classDefinition].join('\n');

    if (!this.checkAndAddToProcessed(fullDefinition, processedChunks)) {
      return this.createNullResult();
    }

    return this.createResult(fullDefinition);
  }

  private parseFunctionDefinition(
    lines: string[],
    node: Node,
    startRow: number,
    processedChunks: Set<string>,
  ): ParseResult {
    const decorators = this.getDecorators(lines, startRow);
    const signature = this.getFunctionSignature(lines, node);

    if (!signature) {
      return this.createNullResult();
    }

    const fullDefinition = [...decorators, signature].join('\n');
    if (!this.checkAndAddToProcessed(fullDefinition, processedChunks)) {
      return this.createNullResult();
    }

    return this.createResult(fullDefinition);
  }

  private parseDocstringOrComment(
    lines: string[],
    startRow: number,
    endRow: number,
    processedChunks: Set<string>,
  ): ParseResult {
    const content = lines.slice(startRow, endRow + 1).join('\n');

    if (!this.checkAndAddToProcessed(content, processedChunks)) {
      return this.createNullResult();
    }

    return this.createResult(content);
  }

  private parseTypeAlias(lines: string[], startRow: number, processedChunks: Set<string>): ParseResult {
    const typeAlias = lines[startRow].trim();

    if (!this.checkAndAddToProcessed(typeAlias, processedChunks)) {
      return this.createNullResult();
    }

    return this.createResult(typeAlias);
  }
}
