import { http, HttpResponse } from 'msw';

export const handlers = [
  // Vercel Blob PUT
  http.put('https://blob.vercel-storage.com/*', () => {
    return HttpResponse.json({ url: 'https://blob.vercel-storage.com/test' });
  }),

  // Vercel Blob LIST
  http.get('https://blob.vercel-storage.com', ({ request }) => {
    const url = new URL(request.url);
    const prefix = url.searchParams.get('prefix') || '';
    return HttpResponse.json({
      blobs: [
        {
          url: `https://blob.vercel-storage.com/${prefix}`,
          downloadUrl: `https://blob.vercel-storage.com/download/${prefix}`,
          size: 1024,
        },
      ],
    });
  }),

  // Vercel Blob download
  http.get('https://blob.vercel-storage.com/download/*', () => {
    return HttpResponse.json({});
  }),

  // WQP API
  http.get('https://www.waterqualitydata.us/data/Result/search', () => {
    return new HttpResponse('', { status: 200 });
  }),

  // ATTAINS REST API
  http.get('https://attains.epa.gov/attains-public/api/*', () => {
    return HttpResponse.json({ items: [] });
  }),

  // ATTAINS GIS
  http.get(
    'https://gispub.epa.gov/arcgis/rest/services/OW/ATTAINS_Assessment/MapServer/1/query',
    () => {
      return HttpResponse.json({ features: [] });
    },
  ),
];
