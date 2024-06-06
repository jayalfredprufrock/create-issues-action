export const titleCase = (str: string): string => {
    return str
        .trim()
        .replace(/([a-z])([A-Z]+)/g, '$1 $2')
        .split(/[-_\s]+/)
        .filter((s) => s.trim())
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
        .join(' ');
}

export const objValueMap = <V, T>(obj: Record<string, V>, transformer: (value: V, key: string) => T): Record<string, T> => {
    return Object.entries(obj).reduce((o, [key, value]) => {
        o[key] = transformer(value, key);
        return o;
    }, {} as Record<string, T>);
};

export const addDaysToDate = (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}