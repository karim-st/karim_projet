export function findNodeJsonRange(
  jsonText: string,
  nodeId: string
): { startLine: number; endLine: number } | null {
  const lines = jsonText.split(/\r?\n/);
  let startLine = -1;
  let endLine = -1;

  // Search for the line that defines this node id
  const idPattern = new RegExp(`"id"\\s*:\\s*"${nodeId}"`);
  
  for (let i = 0; i < lines.length; i++) {
    if (idPattern.test(lines[i])) {
      // Find the start brace of this object (going upwards)
      let braceCount = 0;
      let foundStart = false;
      
      for (let j = i; j >= 0; j--) {
        const line = lines[j];
        if (line.includes("{")) {
          braceCount++;
        }
        if (line.includes("}")) {
          braceCount--;
        }
        if (braceCount === 1) {
          startLine = j + 1; // 1-indexed
          foundStart = true;
          break;
        }
      }
      
      if (!foundStart) {
        startLine = i + 1;
      }
      
      // Find the end brace of this object (going downwards)
      braceCount = 1; // we are inside the object
      for (let j = i + 1; j < lines.length; j++) {
        const line = lines[j];
        // simple brace counting
        for (const char of line) {
          if (char === "{") braceCount++;
          if (char === "}") braceCount--;
        }
        if (braceCount === 0) {
          endLine = j + 1; // 1-indexed
          break;
        }
      }
      
      if (endLine === -1) {
        endLine = startLine + 5; // fallback
      }
      
      return { startLine, endLine };
    }
  }

  return null;
}
