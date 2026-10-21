export const fetcherCopy = {
  en: {
    title: 'Load a teammate profile',
    description: 'Request a demo profile or an unavailable service. Inspect the typed result.',
    successAction: 'Load profile',
    errorAction: 'Try failure',
    reset: 'Reset',
    idle: 'No request sent yet.',
    loading: 'Requesting the demo response...',
    demoLabel: 'Fictional demo response',
    success: 'Success',
    error: 'Error',
    status: 'HTTP status',
    id: 'Profile ID',
    name: 'Name',
    role: 'Role',
    code: 'Error code',
    message: 'Message',
    noResponse: 'No HTTP response',
  },
  ko: {
    title: '팀원 프로필 불러오기',
    description: '데모 프로필과 서비스 오류를 요청하고 타입이 연결된 결과를 확인하세요.',
    successAction: '프로필 요청',
    errorAction: '오류 재현',
    reset: '초기화',
    idle: '아직 요청을 보내지 않았습니다.',
    loading: '데모 응답을 요청하고 있습니다...',
    demoLabel: '가상의 데모 응답',
    success: '성공',
    error: '오류',
    status: 'HTTP 상태',
    id: '프로필 ID',
    name: '이름',
    role: '역할',
    code: '오류 코드',
    message: '메시지',
    noResponse: 'HTTP 응답 없음',
  },
} as const;

export const fetcherSnippets = {
  en: `const api = createFetcher<DemoPaths>();
const result = await api.safe.get(
  '/api/demo/fetcher',
  { params: { query: { outcome } } },
  { signal, retry: 0 },
);
if (result.ok)
  showProfile(result.data.profile);
else
  showError(result.error);`,
  ko: `const api = createFetcher<DemoPaths>();
const result = await api.safe.get(
  '/api/demo/fetcher',
  { params: { query: { outcome } } },
  { signal, retry: 0 },
);
if (result.ok)
  showProfile(result.data.profile);
else
  showError(result.error);`,
} as const;
