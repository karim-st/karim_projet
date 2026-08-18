export function parseJsonSafe<T>(jsonText: string): { data?: T; error?: string } {
  try {
    const data = JSON.parse(jsonText) as T;
    return { data };
  } catch (err: any) {
    return { error: err.message || "Invalid JSON format" };
  }
}
