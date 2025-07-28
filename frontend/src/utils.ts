export const createAbsoluteUrl = (path: string): string => {
  if (path.startsWith('http')) {
    return path;
  }
  const { protocol, host } = window.location;
  return `${protocol}//${host}${path}`;
};