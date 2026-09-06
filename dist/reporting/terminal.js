export function terminalSafe(value) {
    // Deliberately match terminal control bytes so untrusted filenames cannot emit them.
    // eslint-disable-next-line no-control-regex
    return value.replace(/[\u0000-\u001f\u007f-\u009f]/gu, (character) => {
        const codePoint = character.codePointAt(0);
        return codePoint === undefined ? "" : `\\u${codePoint.toString(16).padStart(4, "0")}`;
    });
}
//# sourceMappingURL=terminal.js.map