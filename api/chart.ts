import { handleVercelRequest } from '../server/vercel.ts';
export function GET(request: Request) {
  return handleVercelRequest(request);
}
