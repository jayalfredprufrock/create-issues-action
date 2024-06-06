export const titleCase = (str: string): string => {
    return str
        .trim()
        .replace(/([a-z])([A-Z]+)/g, '$1 $2')
        .split(/[-_\s]+/)
        .filter((s) => s.trim())
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
        .join(' ');
}

const delimRegex = /[\s_\-]+/g;
export const stripDelims = (str: string): string => {
    return str.replaceAll(delimRegex, '');
}