import axios from 'axios';
import { API_BASE_URL, getCsrfToken } from './api';

const LEGACY_PREFIX = 'https://notelibraryapp.com/api/admin/';

const routeMap: Record<string, string> = {
  'books.php': 'legacy/books',
  'subjects.php': 'legacy/catalog-legacy-subjects',
  'getBlogs.php': 'legacy/notices',
  'createBlog.php': 'legacy/notices',
  'updateBlog.php': 'legacy/notices',
  'deleteBlog.php': 'legacy/notices',
  'get_notice_resources.php': 'legacy/notice-assets',
  'upload_notice_resource.php': 'media',
  'delete_notice_resource.php': 'media/delete',
  'videoPlaylist.php': 'legacy/video-playlists',
  'video.php': 'legacy/videos',
  'testSeriesCollection.php': 'legacy/quiz-collections',
  'testSeries.php': 'legacy/quiz-authoring',
  'questionBank.php': 'legacy/question-bank',
  'upload_question_image.php': 'media',
  'download_remote_image.php': 'legacy/question-assets',
  'payment/promocodes.php': 'promo-codes',
  'payment/get_requests.php': 'payment-requests',
  'payment/handle_request.php': 'payment-requests/action',
  'support/get_all_tickets.php': 'support/tickets',
  'support/get_ticket_details.php': 'support/ticket-details',
  'support/admin_reply.php': 'support/replies',
};

function rewrite(input: string): string {
  if (input.startsWith(`${API_BASE_URL}/admin/legacy/`)) return input;
  if (!input.startsWith(LEGACY_PREFIX)) return input;
  const legacy = input.slice(LEGACY_PREFIX.length);
  const [path, query = ''] = legacy.split('?');
  const mapped = routeMap[path] || `legacy/${path.replace(/\.php$/, '')}`;
  return `${API_BASE_URL}/admin/${mapped}${query ? `?${query}` : ''}`;
}

function legacyPayload(payload: any): any {
  if (!payload || typeof payload !== 'object' || !('ok' in payload)) return payload;
  if (!payload.ok) return { success: false, message: payload.error?.message || 'Request failed' };
  return { success: true, ...(payload.data || {}) };
}

axios.interceptors.request.use(async (config) => {
  if (typeof config.url === 'string') config.url = rewrite(config.url);
  config.withCredentials = true;
  config.headers.delete('Authorization');
  const method = (config.method || 'get').toLowerCase();
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    config.headers.set('X-CSRF-Token', await getCsrfToken());
  }
  return config;
});

axios.interceptors.response.use((response) => {
  response.data = legacyPayload(response.data);
  return response;
});

const originalFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const source = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const url = rewrite(source);
  const method = (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
  headers.delete('Authorization');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) headers.set('X-CSRF-Token', await getCsrfToken());
  const response = await originalFetch(url, { ...init, method, headers, credentials: 'include' });
  const payload = await response.clone().json().catch(() => null);
  if (!payload || typeof payload !== 'object' || !('ok' in payload)) return response;
  return new Response(JSON.stringify(legacyPayload(payload)), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};
