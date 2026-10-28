export function normalizeStringLength(input: string, numChars?: number): string {
    if (!numChars) return input;
    if (numChars <= 0) return "";
    if (input.length >= numChars) return input.slice(0, numChars);

    let result = input;

    // Double the string until it reaches enough length
    while (result.length < numChars) {
        result += result + " ";
        // result += result ;
    }

    return result.slice(0, numChars);
}
