import traverse from "@babel/traverse";
import type { BooleanLiteral, CallExpression, ObjectExpression } from "@babel/types";

import {
  asObject,
  literalString,
  memberName,
  objectProperty,
  propertyExpression,
} from "../ast-analysis/babel-utils.js";
import type { Finding } from "../core/schema.js";
import { requireRule } from "../rule-engine/catalogue.js";
import { makeFinding, makeFix, nodeRange } from "../rule-engine/finding.js";
import type { AnalysisContext, SecurityRule } from "../rule-engine/types.js";

const definition = requireRule("AS-SESSION-001");

const SESSION_NAME = /(session|auth|token|sid|jwt)/i;

function reportFlag(
  context: AnalysisContext,
  flag: "secure" | "httpOnly",
  value: BooleanLiteral,
): Finding | undefined {
  if (value.value) return undefined;
  const range = nodeRange(value);
  if (range === undefined) return undefined;
  const isSafe = flag === "httpOnly";
  return makeFinding({
    rule: definition,
    file: context.file,
    startOffset: range.start,
    endOffset: range.end,
    message: `${flag} is explicitly false on an authentication or session cookie.`,
    affectedComponent: "session cookie configuration",
    reachability: "likely",
    autofix: isSafe ? "SAFE" : "REVIEW_REQUIRED",
    ...(isSafe
      ? {
          fix: makeFix(
            context.file,
            range.start,
            range.end,
            "true",
            "Enable HttpOnly for the session cookie.",
          ),
        }
      : {}),
    fingerprintAnchor: `${flag}:${context.file.text.slice(Math.max(0, range.start - 80), range.end + 80)}`,
  });
}

function inspectCookieOptions(context: AnalysisContext, options: ObjectExpression): Finding[] {
  const findings: Finding[] = [];
  for (const flag of ["secure", "httpOnly"] as const) {
    const expression = propertyExpression(objectProperty(options, flag));
    if (expression?.type !== "BooleanLiteral") continue;
    const finding = reportFlag(context, flag, expression);
    if (finding !== undefined) findings.push(finding);
  }
  return findings;
}

function expressCookieOptions(call: CallExpression): ObjectExpression | undefined {
  if (memberName(call.callee) !== "cookie") return undefined;
  const cookieName = literalString(call.arguments[0]);
  if (cookieName === undefined || !SESSION_NAME.test(cookieName)) return undefined;
  return asObject(call.arguments[2]);
}

function expressSessionOptions(
  context: AnalysisContext,
  call: CallExpression,
): ObjectExpression | undefined {
  if (!context.file.text.includes("express-session")) return undefined;
  if (
    call.callee.type !== "Identifier" ||
    !["session", "expressSession"].includes(call.callee.name)
  ) {
    return undefined;
  }
  const options = asObject(call.arguments[0]);
  return asObject(
    propertyExpression(options === undefined ? undefined : objectProperty(options, "cookie")),
  );
}

function analyzeJavaScript(context: AnalysisContext): Finding[] {
  if (context.parsed?.language !== "javascript" && context.parsed?.language !== "typescript")
    return [];
  const findings: Finding[] = [];
  traverse(context.parsed.ast, {
    CallExpression(callPath) {
      const options =
        expressCookieOptions(callPath.node) ?? expressSessionOptions(context, callPath.node);
      if (options !== undefined) findings.push(...inspectCookieOptions(context, options));
    },
  });
  return findings;
}

function analyzePython(context: AnalysisContext): Finding[] {
  if (context.parsed?.language !== "python") return [];
  const findings: Finding[] = [];
  const pattern =
    /(?:^|\n)[ \t]*(?:[A-Za-z_][\w.]*\.config\[\s*["'](SESSION_COOKIE_(?:HTTPONLY|SECURE))["']\s*\]|(SESSION_COOKIE_(?:HTTPONLY|SECURE)))\s*=\s*(False)\b/g;
  for (const match of context.file.text.matchAll(pattern)) {
    const flagName = match.at(1) ?? match.at(2);
    const falseText = match.at(3);
    if (flagName === undefined || falseText === undefined) continue;
    const falseOffsetWithinMatch = match[0].lastIndexOf(falseText);
    const startOffset = match.index + falseOffsetWithinMatch;
    const flag = flagName.endsWith("HTTPONLY") ? "httpOnly" : "secure";
    const isSafe = flag === "httpOnly";
    findings.push(
      makeFinding({
        rule: definition,
        file: context.file,
        startOffset,
        endOffset: startOffset + falseText.length,
        message: `${flagName} is explicitly False.`,
        affectedComponent: "Python session cookie configuration",
        reachability: "likely",
        autofix: isSafe ? "SAFE" : "REVIEW_REQUIRED",
        ...(isSafe
          ? {
              fix: makeFix(
                context.file,
                startOffset,
                startOffset + falseText.length,
                "True",
                "Enable HttpOnly for the session cookie.",
              ),
            }
          : {}),
        fingerprintAnchor: `${flagName}:${match[0].trim()}`,
      }),
    );
  }
  return findings;
}

export const sessionCookieRule: SecurityRule = {
  definition,
  analyze(context) {
    return [...analyzeJavaScript(context), ...analyzePython(context)];
  },
};
