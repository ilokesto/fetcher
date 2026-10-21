export const landingPackages = [
  { name: 'fetcher', title: 'Fetcher', en: 'Send a request. Know what comes back.', ko: '요청을 보내고, 결과를 명확하게.' },
] as const;

export type LandingPackage = (typeof landingPackages)[number];

export function getLandingPackage(name: string) {
  return landingPackages.find(item => item.name === name);
}
