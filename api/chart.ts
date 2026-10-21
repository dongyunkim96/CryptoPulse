import { handleVercelRequest } from '../server/vercel.js';
export function GET(request: Request) {
  return handleVercelRequest(request);
}
