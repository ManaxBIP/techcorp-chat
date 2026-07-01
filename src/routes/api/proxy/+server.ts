import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, url }) => {
  const targetUrl = url.searchParams.get('target');
  if (!targetUrl) {
    throw error(400, 'Missing target URL');
  }

  try {
    const body = await request.json();
    
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'curl/7.64.1', // Bypasses warning pages by acting as a curl request
        'ngrok-skip-browser-warning': 'true', // Bypasses Ngrok landing page
        'Bypass-Tunnel-Reminder': 'true' // Bypasses LocalTunnel landing page
      },
      body: JSON.stringify(body)
    });

    const contentType = response.headers.get('content-type') || 'application/json';
    
    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no'
      }
    });
  } catch (err) {
    console.error('Proxy POST error:', err);
    throw error(500, err instanceof Error ? err.message : 'Unknown error during proxying');
  }
};

export const GET: RequestHandler = async ({ url }) => {
  const targetUrl = url.searchParams.get('target');
  if (!targetUrl) {
    throw error(400, 'Missing target URL');
  }

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'curl/7.64.1', // Act as curl
        'ngrok-skip-browser-warning': 'true', // Bypass Ngrok warning page
        'Bypass-Tunnel-Reminder': 'true' // Bypass LocalTunnel warning page
      }
    });

    const data = await response.text();
    return new Response(data, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json'
      }
    });
  } catch (err) {
    console.error('Proxy GET error:', err);
    throw error(500, err instanceof Error ? err.message : 'Unknown error during proxying');
  }
};
