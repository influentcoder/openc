import ts from "typescript";

export const maximumFileLines = 300;

export interface RuleViolation {
  file: string;
  line: number;
  rule: "file-too-long" | "comment" | "type-assertion";
  detail: string;
}

export function findViolations(file: string, sourceText: string): RuleViolation[] {
  const sourceFile = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKindOf(file),
  );
  return [
    ...fileLengthViolations(file, sourceText),
    ...commentViolations(sourceFile),
    ...typeAssertionViolations(sourceFile),
  ];
}

function scriptKindOf(file: string): ts.ScriptKind {
  return file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

function fileLengthViolations(file: string, sourceText: string): RuleViolation[] {
  const lineCount = sourceText.split("\n").length - (sourceText.endsWith("\n") ? 1 : 0);
  return lineCount > maximumFileLines
    ? [
        {
          file,
          line: 1,
          rule: "file-too-long",
          detail: `${lineCount} lines (maximum ${maximumFileLines})`,
        },
      ]
    : [];
}

function commentViolations(sourceFile: ts.SourceFile): RuleViolation[] {
  const text = sourceFile.getFullText();
  const seen = new Set<number>();
  const violations: RuleViolation[] = [];
  const record = (ranges: ts.CommentRange[] | undefined) => {
    for (const range of ranges ?? []) {
      const comment = text.slice(range.pos, range.end);
      if (seen.has(range.pos) || isAllowedComment(comment)) {
        continue;
      }
      seen.add(range.pos);
      violations.push(violationAt(sourceFile, range.pos, "comment", comment.split("\n")[0] ?? ""));
    }
  };
  const visit = (node: ts.Node) => {
    if (!ts.isJsxText(node)) {
      record(ts.getLeadingCommentRanges(text, node.getFullStart()));
      record(ts.getTrailingCommentRanges(text, node.getEnd()));
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return violations;
}

function isAllowedComment(comment: string): boolean {
  const isWorkaroundWithLink = /workaround/i.test(comment) && comment.includes("https://");
  const isTripleSlashDirective = comment.startsWith("/// <reference");
  return isWorkaroundWithLink || isTripleSlashDirective;
}

function typeAssertionViolations(sourceFile: ts.SourceFile): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const visit = (node: ts.Node) => {
    const isAssertion = ts.isAsExpression(node) || ts.isTypeAssertionExpression(node);
    if (isAssertion && !isConstAssertion(node.type)) {
      violations.push(violationAt(sourceFile, node.getStart(), "type-assertion", node.getText()));
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return violations;
}

function isConstAssertion(type: ts.TypeNode): boolean {
  return ts.isTypeReferenceNode(type) && type.typeName.getText() === "const";
}

function violationAt(
  sourceFile: ts.SourceFile,
  position: number,
  rule: RuleViolation["rule"],
  detail: string,
): RuleViolation {
  const { line } = sourceFile.getLineAndCharacterOfPosition(position);
  return { file: sourceFile.fileName, line: line + 1, rule, detail: detail.slice(0, 80) };
}
